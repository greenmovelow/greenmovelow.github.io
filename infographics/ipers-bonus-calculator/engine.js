/* ============================================================================
   IPERS HYPOTHETICAL INCENTIVE-COMPENSATION CALCULATOR — CALCULATION ENGINE
   Restoring Democracy's Promise

   Every number below is traceable to the IPERS Investment Team Incentive
   Compensation Plan for FY2025, as produced to RDP under Iowa Code ch. 22 and
   as reported in "The Formula Behind the $25,000: What Iowa's Next Governor
   Inherits" (RDP, Aug. 9, 2026).

   This engine models HYPOTHETICAL outcomes permitted by the published formula.
   It does not reconstruct any employee's actual award. IPERS withheld the
   individual evaluation ratings, scorecards and award worksheets under the
   personnel-records exemption at Iowa Code sec. 22.7(11).

   No dependencies. Loaded directly in the browser and by the Node test runner.
   ========================================================================== */

(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.IPERSIncentiveEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* --------------------------------------------------------------------------
     THE PUBLISHED PAYOUT SCHEDULE (FY2025)

     Twenty printed rungs. Each 0.01% of total excess return adds five
     percentage points of payout, reaching 100% at 0.20%. Anything above 0.20%
     pays what 0.20% pays.

     This is a LOOKUP TABLE, not a continuous function. The plan's own worked
     example settles the point: a total excess of 0.054% is reported as a 25%
     award, which is the 0.05% rung. A continuous reading would have produced
     27%. See WORKED_EXAMPLE below.
     ------------------------------------------------------------------------ */

  var PAYOUT_SCHEDULE = [];
  for (var i = 1; i <= 20; i++) {
    PAYOUT_SCHEDULE.push({
      basisPoints: i,
      excessPct: i / 100,                       // 0.01 .. 0.20 (percentage points)
      factor: Math.round(i * 5) / 100           // 0.05 .. 1.00
    });
  }

  /* --------------------------------------------------------------------------
     PUBLISHED PLAN CONSTANTS (FY2025)
     ------------------------------------------------------------------------ */

  var PLAN = {
    fiscalYear: 2025,

    /* Footnote 1 of the plan assigns basis-point values to the annual
       performance evaluation. Anything below "Meets Expectations" disqualifies
       an employee from incentive compensation outright. */
    individualBasisPoints: {
      fails:   null,   // not eligible
      meets:   15,     // 0.15%
      exceeds: 20      // 0.20%
    },

    /* The plan sets one market goal across public and private portfolios:
       20 basis points of excess return above the applicable benchmark. */
    marketGoalBasisPoints: 20,

    payoutSchedule: PAYOUT_SCHEDULE,
    maxPayoutFactor: 1.00,

    /* Chief Investment Officer, FY2025. */
    cio: {
      salary: 300802,              // 2025 state-payroll salary
      maxIncentivePct: 0.50,       // maximum award = 50% of base salary
      weightIndividual: 0.20,
      weightPublic: 0.40,
      weightPrivate: 0.40
    },

    /* Per-person maximum for FY2025, assigned by the chief executive through
       the budget process. Not set by statute. */
    perPersonCap: 25000
  };

  /* --------------------------------------------------------------------------
     THE PLAN'S OWN WORKED EXAMPLE (FY2025)

     Reproduced here as data so the test suite can assert against it directly.
     This example is the controlling evidence for two things: that the
     components are weighted into a single TOTAL EXCESS before the payout
     schedule is consulted, and that the schedule is read as discrete rungs.
     ------------------------------------------------------------------------ */

  var WORKED_EXAMPLE = {
    label: 'Senior RIO - A',
    tenure: '> 3 Years',

    /* Component values after the plan's multi-year tenure calculation. */
    individualExcessPct: 0.15,
    publicExcessPct: 0.00,
    privateExcessPct: 0.12,

    weightIndividual: 0.20,
    weightPublic: 0.60,
    weightPrivate: 0.20,

    /* As printed in the plan. */
    totalExcessPct: 0.054,
    payoutFactor: 0.25,
    salary: 170000,
    maxIncentivePct: 0.25,
    calculatedAward: 10625,
    budgetLimit: 25000,
    finalAward: 10625,

    /* The annual excess figures the example feeds into its tenure-weighted
       calculation include negative years. Recorded here because the exhibit
       must not claim the plan is silent about negative excess. */
    annualPublicExcessPct:  [0.10, -0.05, -0.10],
    annualPrivateExcessPct: [0.30, -0.10,  0.20]
  };

  /* --------------------------------------------------------------------------
     PUBLISHED COMPONENT WEIGHTS BY ROW (FY2025)

     The plan publishes weights for every listed row. Several employees share a
     job classification while carrying different public/private splits, so a
     generic title does not map one-to-one onto a single weighting. That is why
     the exhibit offers only the CIO as a named preset — not because the other
     weights are unpublished.
     ------------------------------------------------------------------------ */

  var PUBLISHED_WEIGHT_ROWS = [
    { title: 'Chief Investment Officer',   individual: 0.20, public: 0.40, private: 0.40, preset: true },
    { title: 'Head of Strategy',           individual: 0.20, public: 0.60, private: 0.20, preset: false },
    { title: 'Senior RIO',                 individual: 0.20, public: 0.60, private: 0.20, preset: false },
    { title: 'Senior RIO',                 individual: 0.20, public: 0.20, private: 0.60, preset: false },
    { title: 'Senior RIO',                 individual: 0.20, public: 0.40, private: 0.40, preset: false },
    { title: 'Retirement Investment Officer', individual: 0.20, public: 0.20, private: 0.60, preset: false },
    { title: 'Retirement Investment Officer', individual: 0.20, public: 0.60, private: 0.20, preset: false },
    { title: 'Retirement Investment Officer', individual: 0.20, public: 0.60, private: 0.20, preset: false },
    { title: 'Executive Officer 2',        individual: 0.50, public: 0.25, private: 0.25, preset: false }
  ];

  /* Maximum incentive percentages the plan assigns by position. */
  var PUBLISHED_MAXIMUMS_BY_POSITION = [
    { title: 'Chief Investment Officer', maxIncentivePct: 0.50 },
    { title: 'Head of Strategy', maxIncentivePct: 0.50 },
    { title: 'Senior investment officers', maxIncentivePct: 0.30 },
    { title: 'Other listed investment-officer and Executive Officer 2 classifications', maxIncentivePct: 0.20 }
  ];

  /* --------------------------------------------------------------------------
     WHAT THE PRIVATE-MARKET COMPONENT CONTAINS

     Private markets are not private equity. Private equity is one private-
     market asset class; it was inside the FY2024 private-market excess
     calculation and is excluded from the FY2025 one.
     ------------------------------------------------------------------------ */

  var PRIVATE_MARKET_COMPOSITION = {
    fy2024: [
      { assetClass: 'Private Equity', weight: 0.20, benchmark: 'Russell 3000 + 300 bp' },
      { assetClass: 'Private Credit', weight: 0.40, benchmark: 'S&P/LSTA Leveraged Loan Index + 100 bp' },
      { assetClass: 'Private Real Assets', weight: 0.40, benchmark: 'NCREIF ODCE Net' }
    ],
    fy2025: [
      { assetClass: 'Private Credit', weight: 0.50 },
      { assetClass: 'Private Real Assets', weight: 0.50 }
    ],
    fy2025PrivateEquityExcluded: true,
    fy2025PlanLanguage: 'The Private Equity portfolio for IPERS are not included in excess considerations.'
  };

  /* --------------------------------------------------------------------------
     COMPONENT FUNCTIONS
     ------------------------------------------------------------------------ */

  /* Weighting three components produces values such as 3.0000000000000004.
     Rounding to a sane precision before any rung lookup keeps floating-point
     noise from dropping a total onto the rung below. */
  function normalizeBasisPoints(bp) {
    return Math.round(Number(bp) * 1e6) / 1e6;
  }

  /**
   * Basis points credited to the annual performance evaluation.
   * Returns null for "fails to meet expectations" — not eligible, not zero.
   */
  function getIndividualBasisPoints(rating) {
    var key = String(rating || '').toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(PLAN.individualBasisPoints, key)) {
      throw new Error('Unknown personnel rating: ' + rating);
    }
    return PLAN.individualBasisPoints[key];
  }

  /**
   * The published payout schedule, read as discrete rungs.
   * Input is TOTAL excess return, in basis points, after weighting.
   *
   * Between two printed rungs the calculator uses the LOWER published rung.
   * That is the only reading consistent with the plan's own worked example,
   * in which a 0.054% total excess is reported as a 25% award — the 0.05%
   * rung. The produced plan does not separately state a general rounding rule,
   * so this is an exhibit convention anchored to that example, not a rule
   * IPERS expressly published.
   *
   * Negative totals are not modeled: see the note on negative excess in the
   * README. Passing one throws rather than extrapolating the schedule below
   * zero or silently flooring the result.
   */
  function getMarketPayoutFactor(totalExcessBasisPoints) {
    var bp = Number(totalExcessBasisPoints);
    if (!isFinite(bp)) { throw new Error('Total excess must be a finite number of basis points.'); }
    if (bp < 0) {
      throw new Error('Negative total excess is not modeled: the produced plan does not establish how a negative blended total enters the payout schedule.');
    }

    var rung = Math.floor(normalizeBasisPoints(bp));
    if (rung < 1) { return 0; }
    if (rung >= PLAN.marketGoalBasisPoints) { return PLAN.maxPayoutFactor; }
    return PAYOUT_SCHEDULE[rung - 1].factor;
  }

  /**
   * The printed rung the payout factor was actually read from, for display.
   * Returns null below the first rung.
   */
  function getAppliedRung(totalExcessBasisPoints) {
    var bp = normalizeBasisPoints(totalExcessBasisPoints);
    if (bp < 1) { return null; }
    var rung = Math.min(Math.floor(bp), PLAN.marketGoalBasisPoints);
    return PAYOUT_SCHEDULE[rung - 1];
  }

  /** True when the total falls between printed rungs and was rounded down. */
  function isBetweenRungs(totalExcessBasisPoints) {
    var bp = normalizeBasisPoints(totalExcessBasisPoints);
    if (bp >= PLAN.marketGoalBasisPoints) { return false; }
    return bp !== Math.floor(bp);
  }

  /* The three weighted contributions, each expressed in basis points of the
     total excess. Named separately because the plan describes the public and
     private components as separately calculated before they are combined. */

  function calculateWeightedIndividualComponent(individualBasisPoints, weightIndividual) {
    return normalizeBasisPoints(individualBasisPoints * weightIndividual);
  }

  function calculateWeightedPublicComponent(publicExcessBasisPoints, weightPublic) {
    return normalizeBasisPoints(publicExcessBasisPoints * weightPublic);
  }

  function calculateWeightedPrivateComponent(privateExcessBasisPoints, weightPrivate) {
    return normalizeBasisPoints(privateExcessBasisPoints * weightPrivate);
  }

  /**
   * TOTAL EXCESS, in basis points — the figure the plan's worked example
   * labels "Total Excess" before reading the payout schedule.
   */
  function calculateBlendedResult(weightedIndividualBp, weightedPublicBp, weightedPrivateBp) {
    return normalizeBasisPoints(weightedIndividualBp + weightedPublicBp + weightedPrivateBp);
  }

  /** The maximum incentive amount: a percentage of base salary. */
  function calculateMaximumIncentive(salary, maxIncentivePct) {
    return salary * maxIncentivePct;
  }

  /** The payout factor is applied against the maximum incentive amount. */
  function calculateRawAward(maximumIncentive, payoutFactor) {
    return maximumIncentive * payoutFactor;
  }

  /** A rating below "Meets Expectations" disqualifies an employee outright. */
  function applyEligibility(rating, award) {
    return getIndividualBasisPoints(rating) === null ? 0 : award;
  }

  /** The resulting award is constrained by the per-person ceiling. */
  function applyDollarCap(award, cap) {
    return Math.min(award, cap);
  }

  /* --------------------------------------------------------------------------
     FULL CALCULATION
     ------------------------------------------------------------------------ */

  /**
   * @param {Object} input
   *   rating              'fails' | 'meets' | 'exceeds'
   *   salary              base salary in dollars
   *   maxIncentivePct     maximum award as a share of base salary (0.50 = 50%)
   *   publicExcessBp      public-market excess return over benchmark, basis points
   *   privateExcessBp     private-market excess return over benchmark, basis points
   *   weightIndividual    0.20 for the CIO
   *   weightPublic        0.40 for the CIO
   *   weightPrivate       0.40 for the CIO
   *   cap                 per-person payment ceiling (25000 for FY2025)
   */
  function calculate(input) {
    var rating = input.rating;
    var salary = Number(input.salary);
    var maxIncentivePct = Number(input.maxIncentivePct);
    var wInd = Number(input.weightIndividual);
    var wPub = Number(input.weightPublic);
    var wPriv = Number(input.weightPrivate);
    var cap = input.cap === undefined ? PLAN.perPersonCap : Number(input.cap);

    var weightsTotal = wInd + wPub + wPriv;
    var weightsValid = Math.abs(weightsTotal - 1) < 1e-9;

    var individualBp = getIndividualBasisPoints(rating);
    var eligible = individualBp !== null;

    var publicBp = Number(input.publicExcessBp);
    var privateBp = Number(input.privateExcessBp);

    var weightedIndividualBp = calculateWeightedIndividualComponent(eligible ? individualBp : 0, wInd);
    var weightedPublicBp = calculateWeightedPublicComponent(publicBp, wPub);
    var weightedPrivateBp = calculateWeightedPrivateComponent(privateBp, wPriv);

    var blendedBp = calculateBlendedResult(weightedIndividualBp, weightedPublicBp, weightedPrivateBp);
    var payoutFactor = getMarketPayoutFactor(blendedBp);
    var appliedRung = getAppliedRung(blendedBp);
    var betweenRungs = isBetweenRungs(blendedBp);

    var maximumIncentive = calculateMaximumIncentive(salary, maxIncentivePct);
    var rawAward = calculateRawAward(maximumIncentive, payoutFactor);

    var eligibleAward = applyEligibility(rating, rawAward);
    var payableAward = applyDollarCap(eligibleAward, cap);

    return {
      eligible: eligible,
      weightsValid: weightsValid,
      weightsTotal: weightsTotal,

      individualBp: individualBp,
      publicBp: publicBp,
      privateBp: privateBp,

      weightedIndividualBp: weightedIndividualBp,
      weightedPublicBp: weightedPublicBp,
      weightedPrivateBp: weightedPrivateBp,

      /* blendedBp is the plan's "Total Excess", in basis points. */
      blendedBp: blendedBp,
      appliedRung: appliedRung,
      betweenRungs: betweenRungs,
      atPlateau: normalizeBasisPoints(blendedBp) >= PLAN.marketGoalBasisPoints,

      payoutFactor: payoutFactor,
      maximumIncentive: maximumIncentive,

      /* rawAward is the arithmetic result before eligibility and the ceiling.
         calculatedAward is that result after eligibility. payableAward is the
         amount after the per-person ceiling is applied. */
      rawAward: rawAward,
      calculatedAward: eligibleAward,
      payableAward: payableAward,
      cap: cap,
      capBinds: eligible && eligibleAward > cap
    };
  }

  /**
   * The base salary at which the given rating reaches the ceiling with both
   * market components exactly matching their benchmarks. Returns null when the
   * payout factor is zero (no threshold exists) or the employee is not eligible.
   */
  function calculateCapThresholdSalary(input) {
    var individualBp = getIndividualBasisPoints(input.rating);
    if (individualBp === null) { return null; }
    var blendedBp = calculateWeightedIndividualComponent(individualBp, Number(input.weightIndividual));
    var factor = getMarketPayoutFactor(blendedBp);
    var cap = input.cap === undefined ? PLAN.perPersonCap : Number(input.cap);
    var denominator = factor * Number(input.maxIncentivePct);
    if (!(denominator > 0)) { return null; }
    return cap / denominator;
  }

  /* --------------------------------------------------------------------------
     PUBLIC API
     ------------------------------------------------------------------------ */

  return {
    PLAN: PLAN,
    PAYOUT_SCHEDULE: PAYOUT_SCHEDULE,
    WORKED_EXAMPLE: WORKED_EXAMPLE,
    PUBLISHED_WEIGHT_ROWS: PUBLISHED_WEIGHT_ROWS,
    PUBLISHED_MAXIMUMS_BY_POSITION: PUBLISHED_MAXIMUMS_BY_POSITION,
    PRIVATE_MARKET_COMPOSITION: PRIVATE_MARKET_COMPOSITION,

    normalizeBasisPoints: normalizeBasisPoints,
    getIndividualBasisPoints: getIndividualBasisPoints,
    getMarketPayoutFactor: getMarketPayoutFactor,
    getAppliedRung: getAppliedRung,
    isBetweenRungs: isBetweenRungs,
    calculateWeightedIndividualComponent: calculateWeightedIndividualComponent,
    calculateWeightedPublicComponent: calculateWeightedPublicComponent,
    calculateWeightedPrivateComponent: calculateWeightedPrivateComponent,
    calculateBlendedResult: calculateBlendedResult,
    calculateMaximumIncentive: calculateMaximumIncentive,
    calculateRawAward: calculateRawAward,
    applyEligibility: applyEligibility,
    applyDollarCap: applyDollarCap,
    calculate: calculate,
    calculateCapThresholdSalary: calculateCapThresholdSalary
  };
});
