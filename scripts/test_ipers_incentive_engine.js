#!/usr/bin/env node
/* ============================================================================
   Verification tests for the IPERS hypothetical incentive-compensation engine.

   Run:  node scripts/test_ipers_incentive_engine.js

   The keystone is the IPERS FY2025 plan's own worked example. It is the
   controlling evidence that the payout schedule is a discrete rung lookup
   rather than a continuous line, and that the components are weighted into a
   single total excess before the schedule is consulted.
   ========================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');

const ENGINE_PATH = path.join(__dirname, '..', 'infographics', 'ipers-bonus-calculator', 'engine.js');
const PAGE_PATH = path.join(__dirname, '..', 'infographics', 'ipers-bonus-calculator', 'index.html');

const E = require(ENGINE_PATH);

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
  if (typeof v === 'number') { return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6); }
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

/* ===========================================================================
   KEYSTONE — OFFICIAL IPERS FY2025 WORKED EXAMPLE

   Senior RIO - A, tenure > 3 years, weights 20 / 60 / 20.
   After the plan's tenure calculation the components are:
     individual 0.15%, public 0.00%, private 0.12%.

   The plan reports Total Excess 0.054% and an award of 25% from the payout
   scale. A continuous reading (5.4 bp x 5 points) would produce 27%, so this
   example is what rules out interpolation.
   =========================================================================== */
console.log('\nOFFICIAL IPERS FY2025 WORKED EXAMPLE — Senior RIO - A');
{
  const W = E.WORKED_EXAMPLE;

  const r = E.calculate({
    rating: 'meets',                                  // 15 bp; overridden below
    salary: W.salary,
    maxIncentivePct: W.maxIncentivePct,
    publicExcessBp: W.publicExcessPct * 100,          // 0.00% -> 0 bp
    privateExcessBp: W.privateExcessPct * 100,        // 0.12% -> 12 bp
    weightIndividual: W.weightIndividual,
    weightPublic: W.weightPublic,
    weightPrivate: W.weightPrivate,
    cap: W.budgetLimit
  });

  // "Meets Expectations" is 15 bp, which is exactly the example's 0.15%
  // individual component, so the plan's own inputs are reproduced directly.
  check('individual component (bp)', r.individualBp, W.individualExcessPct * 100);
  check('weighted individual (bp)', r.weightedIndividualBp, 3, 1e-9);      // 15 x 20%
  check('weighted public (bp)', r.weightedPublicBp, 0, 1e-9);              // 0 x 60%
  check('weighted private (bp)', r.weightedPrivateBp, 2.4, 1e-9);          // 12 x 20%

  check('TOTAL EXCESS matches the plan (%)', r.blendedBp / 100, W.totalExcessPct, 1e-9);
  check('TOTAL EXCESS (bp)', r.blendedBp, 5.4, 1e-9);

  check('AWARD from the payout scale', r.payoutFactor, W.payoutFactor, 1e-9);   // 25%, NOT 27%
  check('payout read from the 0.05% rung', r.appliedRung.excessPct, 0.05, 1e-9);
  check('total falls between printed rungs', r.betweenRungs, true);

  check('maximum incentive ($)', r.maximumIncentive, 42500, 0);            // 25% x $170,000
  check('CALCULATED BONUS ($)', r.calculatedAward, W.calculatedAward, 0);  // $10,625
  check('budget limit ($)', r.cap, W.budgetLimit, 0);
  check('FINAL AWARD ($)', r.payableAward, W.finalAward, 0);
  check('ceiling does not bind', r.capBinds, false);

  // Guard against a regression back to continuous interpolation.
  check('continuous reading (27%) is NOT produced', r.payoutFactor === 0.27, false);
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
  check('total excess (bp)', r.blendedBp, 3, 1e-9);
  check('lands exactly on a printed rung', r.betweenRungs, false);
  check('payout factor', r.payoutFactor, 0.15, 1e-9);
  check('maximum incentive ($)', r.maximumIncentive, 150401, 0.005);
  check('raw calculated award ($)', r.rawAward, 22560, 1);          // 22,560.15
  check('payable award ($)', r.payableAward, 22560, 1);
  check('ceiling binds', r.capBinds, false);
  // The article and the exhibit render this as "90% of the $25,000 ceiling";
  // the precise ratio is 90.24%.
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
  check('total excess (bp)', r.blendedBp, 4, 1e-9);
  check('lands exactly on a printed rung', r.betweenRungs, false);
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
  check('award equals the ceiling, does not exceed it', r.capBinds, false);

  const threshold = E.calculateCapThresholdSalary(Object.assign({}, CIO, { rating: 'exceeds' }));
  check('computed cap-threshold salary ($)', threshold, 250000, 0.005);

  // One dollar below the threshold the award is short of the ceiling.
  const below = scenario({ salary: 249999, rating: 'exceeds', publicExcessBp: 0, privateExcessBp: 0 });
  check('$249,999 falls short of the ceiling ($)', below.payableAward, 24999.9, 0.001);
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
   EVERY PUBLISHED RUNG — 0.01% through 0.20%.
   --------------------------------------------------------------------------- */
console.log('\nEVERY PUBLISHED PAYOUT RUNG (0.01% - 0.20%)');
{
  check('schedule has 20 printed rungs', E.PAYOUT_SCHEDULE.length, 20);
  for (let bp = 1; bp <= 20; bp++) {
    const expected = Math.round(bp * 5) / 100;
    check(`${(bp / 100).toFixed(2)}% total excess -> payout factor`,
      E.getMarketPayoutFactor(bp), expected, 1e-9);
    check(`  rung ${bp} recorded in the published schedule`,
      E.PAYOUT_SCHEDULE[bp - 1].factor, expected, 1e-9);
  }
}

/* ---------------------------------------------------------------------------
   PLATEAU AND FLOOR.
   --------------------------------------------------------------------------- */
console.log('\nPLATEAU AND FLOOR');
{
  check('above 0.20% pays what 0.20% pays (0.25%)', E.getMarketPayoutFactor(25), 1.00, 1e-9);
  check('above 0.20% pays what 0.20% pays (1.00%)', E.getMarketPayoutFactor(100), 1.00, 1e-9);
  check('exactly 0.20% -> 100%', E.getMarketPayoutFactor(20), 1.00, 1e-9);
  check('0.20% is not flagged as between rungs', E.isBetweenRungs(20), false);
  check('0.25% is not flagged as between rungs (plateau)', E.isBetweenRungs(25), false);
  check('below the first rung -> 0%', E.getMarketPayoutFactor(0.9), 0, 1e-9);
  check('exactly zero -> 0%', E.getMarketPayoutFactor(0), 0, 1e-9);
  check('no rung applies below 0.01%', E.getAppliedRung(0.9), null);
}

/* ---------------------------------------------------------------------------
   BETWEEN-RUNG BEHAVIOUR — the lower published rung is used.
   --------------------------------------------------------------------------- */
console.log('\nBETWEEN-RUNG BEHAVIOUR (lower published rung)');
{
  const cases = [
    [5.4, 0.25, 'the plan\'s own worked example'],
    [5.0, 0.25, 'exactly on the 0.05% rung'],
    [5.99, 0.25, 'just below the 0.06% rung'],
    [6.0, 0.30, 'exactly on the 0.06% rung'],
    [3.4, 0.15, 'a CIO total with small public excess'],
    [1.001, 0.05, 'barely above the first rung'],
    [19.99, 0.95, 'just below the top rung'],
    [20.0, 1.00, 'exactly the top rung']
  ];
  cases.forEach(([bp, expected, why]) => {
    check(`${(bp / 100).toFixed(3)}% -> ${(expected * 100)}% (${why})`,
      E.getMarketPayoutFactor(bp), expected, 1e-9);
  });

  check('5.4 bp flagged as between rungs', E.isBetweenRungs(5.4), true);
  check('5.0 bp not flagged as between rungs', E.isBetweenRungs(5.0), false);
  check('applied rung for 5.4 bp is 0.05%', E.getAppliedRung(5.4).excessPct, 0.05, 1e-9);

  // Floating-point noise must not knock a total onto the rung below.
  const noisy = E.calculateBlendedResult(
    E.calculateWeightedIndividualComponent(15, 0.2), 0, 0);
  check('15 bp x 20% normalises to exactly 3 bp', noisy, 3, 0);
  check('noisy 3 bp still reads the 0.03% rung', E.getMarketPayoutFactor(noisy), 0.15, 1e-9);
}

/* ---------------------------------------------------------------------------
   MARKET COMPONENTS — separately calculated, then weighted into the total.
   --------------------------------------------------------------------------- */
console.log('\nMARKET COMPONENTS');
{
  // Meets + 0.01% public excess: 3 + (1 x 40%) = 3.4 bp -> the 0.03% rung.
  const r = scenario({ rating: 'meets', publicExcessBp: 1, privateExcessBp: 0 });
  check('total excess with 0.01% public excess (bp)', r.blendedBp, 3.4, 1e-9);
  check('payout factor still reads the 0.03% rung', r.payoutFactor, 0.15, 1e-9);
  check('award unchanged from zero excess ($)', r.payableAward, 22560, 1);

  // 0.05% public excess moves the total to 5 bp — a full rung up.
  const r5 = scenario({ rating: 'meets', publicExcessBp: 5, privateExcessBp: 0 });
  check('total excess with 0.05% public excess (bp)', r5.blendedBp, 5, 1e-9);
  check('payout factor', r5.payoutFactor, 0.25, 1e-9);
  check('raw calculated award ($)', r5.rawAward, 37600, 1);        // 37,600.25
  check('payable award ($) — ceiling applies', r5.payableAward, 25000, 0);

  // Both components at the plan's 20 bp goal, Exceeds: total 20 bp -> 100%.
  const full = scenario({ rating: 'exceeds', publicExcessBp: 20, privateExcessBp: 20 });
  check('total excess at the goal (bp)', full.blendedBp, 20, 1e-9);
  check('payout factor at the goal', full.payoutFactor, 1.00, 1e-9);
  check('raw calculated award ($)', full.rawAward, 150401, 0.005);
  check('payable award ($)', full.payableAward, 25000, 0);

  // Public and private enter the total separately but symmetrically at equal
  // weights: 10/10 and 20/0 both contribute 8 bp of market excess.
  const split = scenario({ rating: 'meets', publicExcessBp: 10, privateExcessBp: 10 });
  const lopsided = scenario({ rating: 'meets', publicExcessBp: 20, privateExcessBp: 0 });
  check('10/10 total excess (bp)', split.blendedBp, 11, 1e-9);
  check('20/0 total excess (bp)', lopsided.blendedBp, 11, 1e-9);

  // At unequal weights they are not interchangeable.
  const uneven = E.calculate(Object.assign({}, CIO, {
    rating: 'meets', publicExcessBp: 20, privateExcessBp: 0,
    weightPublic: 0.60, weightPrivate: 0.20
  }));
  check('20/0 at 60/20 weights -> total excess (bp)', uneven.blendedBp, 15, 1e-9);
  check('payout factor', uneven.payoutFactor, 0.75, 1e-9);
}

/* ---------------------------------------------------------------------------
   CAP BEHAVIOUR.
   --------------------------------------------------------------------------- */
console.log('\nCAP BEHAVIOUR');
{
  const exact = scenario({ salary: 250000, rating: 'exceeds', publicExcessBp: 0, privateExcessBp: 0 });
  check('award exactly equal to the cap is payable in full ($)', exact.payableAward, 25000, 0);
  check('and is not reported as capped', exact.capBinds, false);

  const over = scenario({ salary: 250001, rating: 'exceeds', publicExcessBp: 0, privateExcessBp: 0 });
  check('one dollar of salary above the threshold crosses the ceiling', over.capBinds, true);
  check('payable is held at the ceiling ($)', over.payableAward, 25000, 0);
  check('calculated is preserved above the ceiling ($)', over.calculatedAward, 25000.1, 0.001);

  check('applyDollarCap holds at the ceiling', E.applyDollarCap(99999, 25000), 25000, 0);
  check('applyDollarCap leaves smaller awards alone', E.applyDollarCap(1000, 25000), 1000, 0);
}

/* ---------------------------------------------------------------------------
   NEGATIVE TOTAL EXCESS — not modeled.
   --------------------------------------------------------------------------- */
console.log('\nNEGATIVE TOTAL EXCESS — not modeled');
{
  let threw = false;
  let message = '';
  try { E.getMarketPayoutFactor(-1); } catch (err) { threw = true; message = err.message; }
  check('negative total throws rather than extrapolating or flooring', threw, true);
  check('and says why', /does not establish/.test(message), true);

  // The plan's worked example does contain negative ANNUAL excess values.
  // The exhibit must not claim the source is silent about negative returns.
  check('worked example records negative annual public excess',
    E.WORKED_EXAMPLE.annualPublicExcessPct.some(v => v < 0), true);
  check('worked example records negative annual private excess',
    E.WORKED_EXAMPLE.annualPrivateExcessPct.some(v => v < 0), true);
}

/* ---------------------------------------------------------------------------
   WEIGHT VALIDATION.
   --------------------------------------------------------------------------- */
console.log('\nWEIGHT VALIDATION');
{
  const bad = scenario({ rating: 'meets', publicExcessBp: 0, privateExcessBp: 0, weightPublic: 0.50 });
  check('weights totalling 110% flagged invalid', bad.weightsValid, false);
  const short = scenario({ rating: 'meets', publicExcessBp: 0, privateExcessBp: 0, weightPublic: 0.30 });
  check('weights totalling 90% flagged invalid', short.weightsValid, false);
  const good = scenario({ rating: 'meets', publicExcessBp: 0, privateExcessBp: 0 });
  check('weights totalling 100% flagged valid', good.weightsValid, true);

  // Every published row sums to 100%.
  E.PUBLISHED_WEIGHT_ROWS.forEach((row, idx) => {
    const total = row.individual + row.public + row.private;
    check(`published row ${idx + 1} (${row.title}) weights sum to 100%`, Math.round(total * 100), 100);
  });
}

/* ---------------------------------------------------------------------------
   PUBLISHED WEIGHT ROWS — the reason there is no generic title preset.
   --------------------------------------------------------------------------- */
console.log('\nPUBLISHED WEIGHT ROWS');
{
  check('CIO row is the only preset', E.PUBLISHED_WEIGHT_ROWS.filter(r => r.preset).length, 1);
  const cio = E.PUBLISHED_WEIGHT_ROWS.find(r => r.preset);
  check('CIO weights are 20/40/40',
    `${cio.individual}/${cio.public}/${cio.private}`, '0.2/0.4/0.4');

  // Several classifications appear more than once with different splits —
  // which is why a title alone does not identify a weighting.
  const seniorRio = E.PUBLISHED_WEIGHT_ROWS.filter(r => r.title === 'Senior RIO');
  check('Senior RIO appears on multiple rows', seniorRio.length > 1, true);
  const splits = new Set(seniorRio.map(r => `${r.public}/${r.private}`));
  check('Senior RIO rows carry different public/private splits', splits.size > 1, true);

  const rio = E.PUBLISHED_WEIGHT_ROWS.filter(r => r.title === 'Retirement Investment Officer');
  const rioSplits = new Set(rio.map(r => `${r.public}/${r.private}`));
  check('Retirement Investment Officer rows also differ', rioSplits.size > 1, true);

  const eo2 = E.PUBLISHED_WEIGHT_ROWS.find(r => r.title === 'Executive Officer 2');
  check('Executive Officer 2 carries a 50% individual weight', eo2.individual, 0.50, 1e-9);
}

/* ---------------------------------------------------------------------------
   PRIVATE-MARKET COMPOSITION — private markets are not private equity.
   --------------------------------------------------------------------------- */
console.log('\nPRIVATE-MARKET COMPOSITION');
{
  const P = E.PRIVATE_MARKET_COMPOSITION;

  const fy24 = P.fy2024.map(a => a.assetClass);
  check('FY2024 private-market component included Private Equity',
    fy24.indexOf('Private Equity') >= 0, true);
  check('FY2024 Private Equity weight', P.fy2024[0].weight, 0.20, 1e-9);
  check('FY2024 weights sum to 100%',
    Math.round(P.fy2024.reduce((s, a) => s + a.weight, 0) * 100), 100);

  const fy25 = P.fy2025.map(a => a.assetClass);
  check('FY2025 private-market component excludes Private Equity',
    fy25.indexOf('Private Equity'), -1);
  check('FY2025 retains Private Credit', fy25.indexOf('Private Credit') >= 0, true);
  check('FY2025 retains Private Real Assets', fy25.indexOf('Private Real Assets') >= 0, true);
  check('FY2025 remaining classes reweighted to 50% each',
    P.fy2025.every(a => a.weight === 0.50), true);
  check('FY2025 weights sum to 100%',
    Math.round(P.fy2025.reduce((s, a) => s + a.weight, 0) * 100), 100);
  check('exclusion flag set', P.fy2025PrivateEquityExcluded, true);
}

/* ---------------------------------------------------------------------------
   CAP THRESHOLDS AT OTHER PUBLISHED MAXIMUMS.
   --------------------------------------------------------------------------- */
console.log('\nCAP THRESHOLDS AT OTHER PUBLISHED MAXIMUMS');
{
  // These reuse the CIO's 20% individual weight, which the plan establishes
  // only for the CIO row; shown here to confirm the function generalises.
  const t30 = E.calculateCapThresholdSalary(Object.assign({}, CIO, { rating: 'exceeds', maxIncentivePct: 0.30 }));
  const t20 = E.calculateCapThresholdSalary(Object.assign({}, CIO, { rating: 'exceeds', maxIncentivePct: 0.20 }));
  check('30% maximum incentive -> threshold ($)', t30, 416666.6667, 0.001);
  check('20% maximum incentive -> threshold ($)', t20, 625000, 0.005);

  const noFactor = E.calculateCapThresholdSalary(
    Object.assign({}, CIO, { rating: 'exceeds', weightIndividual: 0.04 }));
  check('an individual weight too small to reach a rung has no threshold', noFactor, null);
}

/* ===========================================================================
   STATIC CONTENT CHECKS

   These guard the exhibit's source language against future copy edits. They
   read the published page rather than the engine.
   =========================================================================== */
console.log('\nSTATIC CONTENT — exhibit source language');
{
  const html = fs.readFileSync(PAGE_PATH, 'utf8');
  const text = html.replace(/\s+/g, ' ');

  function mustContain(label, needle) {
    check(label, text.indexOf(needle) >= 0, true);
  }
  function mustNotContain(label, needle) {
    check(label, text.toLowerCase().indexOf(needle.toLowerCase()) >= 0, false);
  }

  // The actual-award firewall.
  mustContain('states the exhibit does not establish any actual award',
    'it does not establish how any actual award was calculated');
  mustContain('records that IPERS withheld ratings and worksheets',
    'did not produce the CIO&rsquo;s individual evaluation ratings or award worksheets');

  // Private markets are not private equity.
  mustContain('private control names Private Credit', 'Private Credit');
  mustContain('private control names Private Real Assets', 'Private Real Assets');
  mustContain('states private equity is excluded from the FY2025 calculation',
    'Private equity is excluded from this calculation');
  mustNotContain('does not say IPERS removed private equity outright',
    'IPERS removed private equity');
  mustNotContain('does not say IPERS stopped investing in private equity',
    'stopped investing in private equity');
  mustNotContain('does not equate private markets with private equity',
    'private markets (private equity)');

  // The payout schedule is described as discrete rungs.
  mustContain('describes the lower published rung convention', 'lower published rung');
  mustContain('cites the worked example in the methodology', '0.054%');
  mustNotContain('no longer claims the ladder climbs continuously',
    'each basis point of excess return adds five percentage points of payout factor');

  // Negative excess is described accurately.
  mustNotContain('no longer claims the plan is silent on negative excess',
    'it does not establish how excess return below the benchmark enters the table');
  mustContain('acknowledges negative annual excess in the worked example',
    'positive and negative annual excess');

  // Non-CIO weights are described accurately.
  mustNotContain('no longer claims non-CIO weights are unestablished',
    'weightings for those classifications are not established');
  mustContain('explains why only the CIO is a preset',
    'share the same job classification');

  // Editorial vocabulary.
  mustContain('uses "hypothetical calculated award"', 'Hypothetical Calculated Award');
  mustContain('uses "applicable benchmark"', 'applicable benchmark');
  mustContain('uses "payment ceiling"', 'payment ceiling');
  mustNotContain('avoids "actual bonus"', 'actual bonus');
  mustNotContain('avoids "guaranteed bonus"', 'guaranteed bonus');
  mustNotContain('avoids "automatic bonus"', 'automatic bonus');
  mustNotContain('avoids "0% investment return"', '0% investment return');
  mustNotContain('avoids "0% return"', '0% return');

  // The bottom sticky readout is gone; the top live bar replaced it.
  mustNotContain('bottom sticky readout removed', 'sticky-readout');
  mustContain('top live result bar present', 'id="live-bar"');
}

/* --------------------------------------------------------------------------- */
console.log(`\n${'='.repeat(64)}`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(64)}\n`);
process.exit(failed === 0 ? 0 : 1);
