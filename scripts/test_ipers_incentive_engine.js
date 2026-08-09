#!/usr/bin/env node
/* ============================================================================
   Verification tests for the IPERS hypothetical incentive-compensation engine.

   Run:  node scripts/test_ipers_incentive_engine.js

   These cases check the engine against the figures published in
   "The Formula Behind the $25,000: What Iowa's Next Governor Inherits"
   (RDP, Aug. 9, 2026), which derives them from the IPERS Investment Team
   Incentive Compensation Plan for FY2025.
   ========================================================================== */

'use strict';

const E = require('../infographics/ipers-bonus-calculator/engine.js');

let passed = 0;
let failed = 0;

function check(label, actual, expected, tolerance) {
  const tol = tolerance === undefined ? 0 : tolerance;
  const ok = (typeof expected === 'number' && typeof actual === 'number')
    ? Math.abs(actual - expected) <= tol
    : actual === expected;
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}  =>  ${format(actual)}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}  =>  got ${format(actual)}, expected ${format(expected)}${tol ? ` (+/- ${tol})` : ''}`);
  }
}

function format(v) {
  if (typeof v === 'number') { return Number.isInteger(v) ? String(v) : v.toFixed(4).replace(/0+$/, '').replace(/\.$/, ''); }
  return String(v);
}

const CIO = {
  salary: 300802,
  maxIncentivePct: 0.50,
  weightIndividual: 0.20,
  weightPublic: 0.40,
  weightPrivate: 0.40,
  cap: 25000
};

function scenario(overrides) {
  return E.calculate(Object.assign({}, CIO, overrides));
}

/* ---------------------------------------------------------------------------
   CASE A — CIO, Meets Expectations, both market components exactly matching
   their applicable benchmarks.
   --------------------------------------------------------------------------- */
console.log('\nCASE A — CIO / Meets Expectations / zero market excess');
{
  const r = scenario({ rating: 'meets', publicExcessBp: 0, privateExcessBp: 0 });
  check('individual basis points', r.individualBp, 15);
  check('weighted individual contribution (bp)', r.weightedIndividualBp, 3, 1e-9);
  check('blended total (bp)', r.blendedBp, 3, 1e-9);
  check('payout factor', r.payoutFactor, 0.15, 1e-9);
  check('maximum incentive ($)', r.maximumIncentive, 150401, 0.005);
  check('raw calculated award ($)', r.rawAward, 22560, 1);          // 22,560.15
  check('payable award ($)', r.payableAward, 22560, 1);
  check('ceiling binds', r.capBinds, false);
  // The article and the exhibit both render this as "90% of the $25,000
  // ceiling"; the precise ratio is 90.24%, which rounds to 90 for display.
  check('share of $25,000 ceiling, precise (%)', (r.payableAward / 25000) * 100, 90.2406, 0.0001);
  check('share of $25,000 ceiling, as displayed (%)', Math.round((r.payableAward / 25000) * 100), 90, 0);
}

/* ---------------------------------------------------------------------------
   CASE B — CIO, Exceeds Expectations, zero market excess.
   --------------------------------------------------------------------------- */
console.log('\nCASE B — CIO / Exceeds Expectations / zero market excess');
{
  const r = scenario({ rating: 'exceeds', publicExcessBp: 0, privateExcessBp: 0 });
  check('individual basis points', r.individualBp, 20);
  check('weighted individual contribution (bp)', r.weightedIndividualBp, 4, 1e-9);
  check('blended total (bp)', r.blendedBp, 4, 1e-9);
  check('payout factor', r.payoutFactor, 0.20, 1e-9);
  check('maximum incentive ($)', r.maximumIncentive, 150401, 0.005);
  check('raw calculated award ($)', r.rawAward, 30080, 1);          // 30,080.20
  check('ceiling binds', r.capBinds, true);
  check('payable award ($)', r.payableAward, 25000, 0);
}

/* ---------------------------------------------------------------------------
   CASE C — the cap threshold: $250,000 salary, Exceeds, zero market excess.
   --------------------------------------------------------------------------- */
console.log('\nCASE C — $250,000 salary / Exceeds Expectations / zero market excess');
{
  const r = scenario({ salary: 250000, rating: 'exceeds', publicExcessBp: 0, privateExcessBp: 0 });
  check('maximum incentive ($)', r.maximumIncentive, 125000, 0);
  check('raw calculated award ($)', r.rawAward, 25000, 0);
  check('payable award ($)', r.payableAward, 25000, 0);
  check('ceiling binds (award equals, does not exceed)', r.capBinds, false);

  const threshold = E.calculateCapThresholdSalary(Object.assign({}, CIO, { rating: 'exceeds' }));
  check('computed cap-threshold salary ($)', threshold, 250000, 0.005);
}

/* ---------------------------------------------------------------------------
   CASE D — Fails to Meet Expectations: not eligible.
   --------------------------------------------------------------------------- */
console.log('\nCASE D — Fails to Meet Expectations');
{
  const r = scenario({ rating: 'fails', publicExcessBp: 0, privateExcessBp: 0 });
  check('eligible', r.eligible, false);
  check('individual basis points', r.individualBp, null);
  check('calculated award ($)', r.calculatedAward, 0, 0);
  check('payable award ($)', r.payableAward, 0, 0);

  const rHigh = scenario({ rating: 'fails', publicExcessBp: 20, privateExcessBp: 20 });
  check('payable award with full market excess ($)', rHigh.payableAward, 0, 0);

  check('cap-threshold salary is undefined', E.calculateCapThresholdSalary(
    Object.assign({}, CIO, { rating: 'fails' })), null);
}

/* ---------------------------------------------------------------------------
   LADDER — the published payout schedule, rung by rung.
   --------------------------------------------------------------------------- */
console.log('\nPAYOUT LADDER — published rungs');
{
  const rungs = [[1, 0.05], [2, 0.10], [3, 0.15], [4, 0.20], [5, 0.25],
                 [10, 0.50], [15, 0.75], [20, 1.00]];
  rungs.forEach(([bp, factor]) => {
    check(`${(bp / 100).toFixed(2)}% excess -> payout factor`, E.getMarketPayoutFactor(bp), factor, 1e-9);
  });
  check('above 0.20% pays what 0.20% pays (25 bp)', E.getMarketPayoutFactor(25), 1.00, 1e-9);
  check('per-component clamp at the 20 bp goal', E.clampToMarketGoal(35), 20, 0);
}

/* ---------------------------------------------------------------------------
   MARKET COMPONENTS — public and private are calculated separately.
   --------------------------------------------------------------------------- */
console.log('\nMARKET COMPONENTS');
{
  // Meets + 0.01% public excess: 3 bp + (1 bp x 40%) = 3.4 bp -> 17% factor.
  const r = scenario({ rating: 'meets', publicExcessBp: 1, privateExcessBp: 0 });
  check('blended total with 0.01% public excess (bp)', r.blendedBp, 3.4, 1e-9);
  check('payout factor', r.payoutFactor, 0.17, 1e-9);
  check('raw calculated award ($)', r.rawAward, 25568, 1);          // 25,568.17
  check('payable award ($) — ceiling applies', r.payableAward, 25000, 0);

  // Both components at the 20 bp goal, Exceeds: blended 20 bp -> 100%.
  const full = scenario({ rating: 'exceeds', publicExcessBp: 20, privateExcessBp: 20 });
  check('blended total at full goal (bp)', full.blendedBp, 20, 1e-9);
  check('payout factor at full goal', full.payoutFactor, 1.00, 1e-9);
  check('raw calculated award ($)', full.rawAward, 150401, 0.005);
  check('payable award ($)', full.payableAward, 25000, 0);

  // Components are separate: public 20 / private 0 is not the same as 10 / 10
  // only where the per-component clamp bites; below the goal they are additive.
  const split = scenario({ rating: 'meets', publicExcessBp: 10, privateExcessBp: 10 });
  const lopsided = scenario({ rating: 'meets', publicExcessBp: 20, privateExcessBp: 0 });
  check('10/10 blended (bp)', split.blendedBp, 11, 1e-9);
  check('20/0 blended (bp)', lopsided.blendedBp, 11, 1e-9);
  const overGoal = scenario({ rating: 'meets', publicExcessBp: 40, privateExcessBp: 0 });
  check('40/0 blended (bp) — clamped to the 20 bp goal', overGoal.blendedBp, 11, 1e-9);
}

/* ---------------------------------------------------------------------------
   NEGATIVE EXCESS — not modeled.
   --------------------------------------------------------------------------- */
console.log('\nNEGATIVE EXCESS — not modeled');
{
  let threw = false;
  try { E.getMarketPayoutFactor(-1); } catch (err) { threw = true; }
  check('negative excess throws rather than extrapolating or flooring', threw, true);
}

/* ---------------------------------------------------------------------------
   WEIGHT VALIDATION
   --------------------------------------------------------------------------- */
console.log('\nWEIGHT VALIDATION');
{
  const bad = scenario({ rating: 'meets', publicExcessBp: 0, privateExcessBp: 0, weightPublic: 0.50 });
  check('weights totalling 110% flagged invalid', bad.weightsValid, false);
  const good = scenario({ rating: 'meets', publicExcessBp: 0, privateExcessBp: 0 });
  check('weights totalling 100% flagged valid', good.weightsValid, true);
}

/* ---------------------------------------------------------------------------
   ADVANCED RANGES — thresholds at other published maximum-incentive levels.
   --------------------------------------------------------------------------- */
console.log('\nCAP THRESHOLDS AT OTHER PUBLISHED MAXIMUMS');
{
  // These use the CIO's 20% individual weight, which the plan establishes only
  // for the CIO; shown here to confirm the threshold function generalises.
  const t30 = E.calculateCapThresholdSalary(Object.assign({}, CIO, { rating: 'exceeds', maxIncentivePct: 0.30 }));
  const t20 = E.calculateCapThresholdSalary(Object.assign({}, CIO, { rating: 'exceeds', maxIncentivePct: 0.20 }));
  check('30% maximum incentive -> threshold ($)', t30, 416666.6667, 0.001);
  check('20% maximum incentive -> threshold ($)', t20, 625000, 0.005);
}

/* --------------------------------------------------------------------------- */
console.log(`\n${'='.repeat(60)}`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(60)}\n`);
process.exit(failed === 0 ? 0 : 1);
