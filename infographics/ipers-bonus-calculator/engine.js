/* ============================================================================
   IPERS HYPOTHETICAL INCENTIVE-COMPENSATION CALCULATOR — CALCULATION ENGINE
   Restoring Democracy's Promise

   Every number below is traceable to the IPERS Investment Team Incentive
   Compensation Plan for FY2025, as produced to RDP under Iowa Code ch. 22 and
   as described in "The Formula Behind the $25,000: What Iowa's Next Governor
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

    /* The payout ladder: each basis point of excess return adds five
       percentage points of payout factor, reaching 100% at 20 basis points.
       Anything above 20 basis points pays what 20 basis points pays. */
    payoutFactorPerBasisPoint: 0.05,
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

  /* Maximum incentive percentages the FY2025 plan assigns by position. The
     plan's public/private weightings for the non-CIO classifications are not
     modeled here, so these are documentation only — not selectable presets. */
  var PUBLISHED_MAXIMUMS_BY_POSITION = [
    { title: 'Chief Investment Officer', maxIncentivePct: 0.50, modeled: true },
    { title: 'Head of Strategy', maxIncentivePct: 0.50, modeled: false },
    { title: 'Senior investment officers', maxIncentivePct: 0.30, modeled: false },
    { title: 'Other listed investment-officer and Executive Officer 2 classifications', maxIncentivePct: 0.20, modeled: false }
  ];

  /* --------------------------------------------------------------------------
     COMPONENT FUNCTIONS
     ------------------------------------------------------------------------ */

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
   * The published payout ladder, expressed as a factor (0.05 = 5%).
   * Input is excess return over the applicable benchmark, in basis points.
   *
   * Negative excess is NOT modeled: the published plan does not establish how
   * excess below zero enters this table, so the controls are constrained to
   * source-supported values beginning at 0.00%. Passing a negative value
   * throws rather than silently flooring or extrapolating the ladder.
   */
  function getMarketPayoutFactor(excessBasisPoints) {
    var bp = Number(excessBasisPoints);
    if (!isFinite(bp)) { throw new Error('Excess return must be a finite number of basis points.'); }
    if (bp < 0) { throw new Error('Negative-excess treatment is not modeled: the published plan does not specify how it enters the payout table.'); }
    return Math.min(bp * PLAN.payoutFactorPerBasisPoint, PLAN.maxPayoutFactor);
  }

  /**
   * "Anything above 20 basis points pays what 20 basis points pays."
   * Applied per market component before weighting.
   */
  function clampToMarketGoal(excessBasisPoints) {
    return Math.min(Math.max(Number(excessBasisPoints), 0), PLAN.marketGoalBasisPoints);
  }

  /* The three weighted contributions, each expressed in basis points of the
     blended total. Keeping them as separate named functions mirrors the way
     the plan describes the components as separately calculated. */

  function calculateWeightedIndividualComponent(individualBasisPoints, weightIndividual) {
    return individualBasisPoints * weightIndividual;
  }

  function calculateWeightedPublicComponent(publicExcessBasisPoints, weightPublic) {
    return clampToMarketGoal(publicExcessBasisPoints) * weightPublic;
  }

  function calculateWeightedPrivateComponent(privateExcessBasisPoints, weightPrivate) {
    return clampToMarketGoal(privateExcessBasisPoints) * weightPrivate;
  }

  /**
   * The blended total, in basis points — the figure the article describes as
   * what the components "contribute to the blended total."
   */
  function calculateBlendedResult(weightedIndividualBp, weightedPublicBp, weightedPrivateBp) {
    return weightedIndividualBp + weightedPublicBp + weightedPrivateBp;
  }

  /**
   * The maximum incentive amount: a percentage of base salary.
   */
  function calculateMaximumIncentive(salary, maxIncentivePct) {
    return salary * maxIncentivePct;
  }

  /**
   * The payout factor is applied against the maximum incentive amount.
   */
  function calculateRawAward(maximumIncentive, payoutFactor) {
    return maximumIncentive * payoutFactor;
  }

  /**
   * A rating below "Meets Expectations" disqualifies an employee outright.
   */
  function applyEligibility(rating, award) {
    return getIndividualBasisPoints(rating) === null ? 0 : award;
  }

  /**
   * The resulting award is constrained by the per-person ceiling.
   */
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

    var publicBpUsed = clampToMarketGoal(input.publicExcessBp);
    var privateBpUsed = clampToMarketGoal(input.privateExcessBp);
    var publicClamped = Number(input.publicExcessBp) > PLAN.marketGoalBasisPoints;
    var privateClamped = Number(input.privateExcessBp) > PLAN.marketGoalBasisPoints;

    var weightedIndividualBp = calculateWeightedIndividualComponent(eligible ? individualBp : 0, wInd);
    var weightedPublicBp = calculateWeightedPublicComponent(publicBpUsed, wPub);
    var weightedPrivateBp = calculateWeightedPrivateComponent(privateBpUsed, wPriv);

    var blendedBp = calculateBlendedResult(weightedIndividualBp, weightedPublicBp, weightedPrivateBp);
    var payoutFactor = getMarketPayoutFactor(blendedBp);

    var maximumIncentive = calculateMaximumIncentive(salary, maxIncentivePct);
    var rawAward = calculateRawAward(maximumIncentive, payoutFactor);

    var eligibleAward = applyEligibility(rating, rawAward);
    var payableAward = applyDollarCap(eligibleAward, cap);

    return {
      eligible: eligible,
      weightsValid: weightsValid,
      weightsTotal: weightsTotal,

      individualBp: individualBp,
      publicBpUsed: publicBpUsed,
      privateBpUsed: privateBpUsed,
      publicClamped: publicClamped,
      privateClamped: privateClamped,

      weightedIndividualBp: weightedIndividualBp,
      weightedPublicBp: weightedPublicBp,
      weightedPrivateBp: weightedPrivateBp,
      blendedBp: blendedBp,

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
   * The base salary at which the given rating reaches the ceiling with zero
   * market excess. Returns null when the payout factor is zero (no threshold
   * exists) or when the employee is not eligible.
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
    PUBLISHED_MAXIMUMS_BY_POSITION: PUBLISHED_MAXIMUMS_BY_POSITION,
    getIndividualBasisPoints: getIndividualBasisPoints,
    getMarketPayoutFactor: getMarketPayoutFactor,
    clampToMarketGoal: clampToMarketGoal,
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
