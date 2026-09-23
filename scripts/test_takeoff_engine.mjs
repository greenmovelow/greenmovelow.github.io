#!/usr/bin/env node
/*
 * Regression test for takeoff/engine.js.
 * Run: node scripts/test_takeoff_engine.js
 *
 * Uses a synthetic pump-station bid set modeled on the structure of a real
 * Division 26 / Division 40 project manual (spec sections, drawing schedule
 * text, an addendum). No real project text is included.
 */
import assert from 'node:assert/strict';
import {
  analyzeProject, buildICS, selectRelevantPages, renderTakeoffReport, renderQuoteRequest, renderRfiLog, BUCKETS,
} from '../takeoff/engine.js';

const SPEC = `
SECTION 00 11 13 ADVERTISEMENT FOR BIDS
Sealed Bids for the construction of the Eastside Pump Station Replacement will be received by the City of Exampleton, Iowa at City Hall until 2:00 PM local time on October 14, 2026, at which time the Bids received will be publicly opened and read.
Questions regarding the Bidding Documents shall be submitted in writing to the Engineer no later than 5:00 PM on October 6, 2026.
A pre-bid conference will be held at 10:00 AM on September 30, 2026.
Bidders shall acknowledge receipt of all Addenda on the Bid Form. Addendum No. 1 and Addendum No. 2 have been issued.
This project is funded in part by the Clean Water State Revolving Fund (SRF). American Iron and Steel (AIS) requirements apply to all iron and steel products permanently incorporated into the project.
Substitution requests must be received by the Engineer no less than 10 days prior to the bid opening.

SECTION 26 24 16 PANELBOARDS
2.03 Distribution panelboards shall be rated 480Y/277 V, 3-phase, 4-wire, 600 A main circuit breaker, copper bus, with a minimum interrupting rating of 65 kAIC fully rated.
2.04 Lighting and appliance panelboards shall be 208Y/120 V with a minimum interrupting rating of 22 kAIC.
Panelboards shall be Square D, Eaton, Siemens or approved equal.

SECTION 26 22 00 LOW-VOLTAGE TRANSFORMERS
Transformer T-1 shall be 30 kVA, 480 V delta primary, 208Y/120 V secondary, dry type, indoor Type 2 enclosure.

SECTION 26 28 16 ENCLOSED SWITCHES AND CIRCUIT BREAKERS
Disconnect switches located outdoors shall be Type 4X stainless steel enclosures.

SECTION 26 29 23 VARIABLE FREQUENCY MOTOR CONTROLLERS
2.02 Each VFD shall be a standalone packaged nonbypass controller with integral input disconnect, 5% line reactor, and output load reactor. dV/dt filters are required where motor lead length exceeds 100 feet. Drives shall meet IEEE 519 harmonic limits. Drive SCCR shall be not less than the available fault current. Communications shall be Modbus TCP.
Acceptable manufacturers: Allen-Bradley, Danfoss, Yaskawa, ABB.

SECTION 26 32 13 ENGINE GENERATORS
The 450 kW standby diesel generator shall be Cummins, Kohler or Caterpillar. Generator load step schedule includes Pump P-1 at 150 HP.

SECTION 26 36 00 TRANSFER SWITCHES
Provide one 600 A service-rated automatic transfer switch ATS-1, delayed transition, 480/277 V.

SECTION 26 43 00 SURGE PROTECTIVE DEVICES
Provide SPD integral to panelboard HP-1.

SECTION 26 05 26 GROUNDING AND BONDING FOR ELECTRICAL SYSTEMS
Ground rods shall be 3/4 inch by 10 feet copper-clad. Exothermic connections below grade.

SECTION 26 05 33 RACEWAYS AND BOXES FOR ELECTRICAL SYSTEMS
Conduit: RMC above grade outdoors, PVC schedule 40 below grade, EMT indoors.

SECTION 40 90 10 PROCESS CONTROLS AND DEVICES
1.02 The Systems Integrator shall furnish, program, and start up the lift station control panel SCP-1 including PLC, HMI, managed Ethernet switch, UPS and radio telemetry. The Systems Integrator shall be responsible for all field control wiring. PLC shall be CompactLogix 5069 or equal. HMI shall be PanelView Plus.
2.05 Level transducer LIT-1 and float switches LSH-1 and LSL-1 shall be furnished by the Systems Integrator. Magnetic flow meter FIT-1 shall be furnished by the process equipment supplier and installed by the Contractor.

SECTION 43 21 25 SUBMERSIBLE PUMPS
Pumps P-1 and P-2 shall be 140 HP, 460 V, 3-phase submersible wastewater pumps, Flygt or equal. Pump moisture and temperature protection relays shall be furnished by the pump supplier.

SECTION 41 22 13 CRANES AND HOISTS
Jib crane DAV-1 with 1 HP electric hoist, controls and pendant furnished by the crane supplier.

SECTION 23 05 13 COMMON MOTOR REQUIREMENTS FOR HVAC EQUIPMENT
Condensing units CU-1 and CU-2 and fan coil units FCU-1 and FCU-2 shall be Mitsubishi Electric. Electric unit heater EUH-1. Disconnects for HVAC equipment shall be furnished and installed by Division 26 unless factory mounted.
`;

const DRAWINGS = `
SHEET E3 ELECTRICAL PLAN AND PANEL SCHEDULES
PANEL LP-1 100 A MCB 208Y/120 V 3PH 4W 30 CKT 10 kA
CKT 7 VALVE VAULT DAVIT CRANE 20 A/1P
CKT 9 MOTORIZED SECURITY GATE 20 A/1P
CKT 11/13 CU-1 30 A/2P DIS-CU-1 NEMA 3R
GENERAL NOTES: 1. All outdoor disconnects shall be NEMA 3R.

SHEET E5 ONE-LINE DIAGRAM
PANEL HP-1 600 A MCB 480Y/277 V 42 kA
P-1 VFD 140 HP 225 A/3P DIS-P1 400 A
P-2 VFD 140 HP 225 A/3P DIS-P2 400 A
ATS-1 600 A GEN-1 450 kW
T-1 30 kVA
SEE SHEET E-7 FOR VFD SCHEMATIC
`;

const ADDENDUM = `
ADDENDUM NO. 3 dated October 2, 2026
This Addendum takes precedence over the original Bidding Documents. Bidders shall acknowledge receipt of this Addendum on the Bid Form.
Sheet E3: General Note 3 added: Provide 3-inch housekeeping pads for all floor mounted equipment such as transfer switches, VFD's, and transformers.
Sheet E3: Panel LP-1 circuit 7 changed to SPARE. Circuit 9 changed to SPARE.
Section 26 05 26: Add paragraph 2.01.K Metallic fence shall be grounded per IEEE C2 with No. 8 AWG bare copper.
`;

function pagesFrom(text) {
  return text.split(/\n\s*\n(?=SECTION|SHEET|ADDENDUM)/).map((t, i) => ({ n: i + 1, text: t }));
}

const docs = [
  { id: 'spec', name: 'Project Manual.pdf', role: 'spec', pages: pagesFrom(SPEC), sha256: 'a'.repeat(64) },
  { id: 'dwg', name: 'E-SHEETS.pdf', role: 'drawings', pages: pagesFrom(DRAWINGS) },
  { id: 'ad3', name: 'Addendum 3.pdf', role: 'addendum', pages: pagesFrom(ADDENDUM) },
];

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok   ${name}`); } catch (e) { failures++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

console.log('takeoff engine tests');

// Pass 1: no answers -> defaults come from detection.
const r1 = analyzeProject(docs, {}, { now: '2026-09-20T12:00:00' });
const d = r1.detection;
const v = d.values;
const q = Object.fromEntries(r1.questions.map((x) => [x.id, x]));

check('sections: Division 26 and 40 sections detected', () => {
  const codes = d.sections.map((s) => s.code);
  for (const c of ['26 24 16', '26 22 00', '26 29 23', '26 32 13', '26 36 00', '40 90 10', '43 21 25', '41 22 13', '23 05 13']) assert.ok(codes.includes(c), `missing ${c}`);
});
check('sections: printed title preferred over catalog', () => {
  const s = d.sections.find((x) => x.code === '40 90 10');
  assert.match(s.title, /PROCESS CONTROLS AND DEVICES/);
});
check('tags: equipment tags found with family assignment', () => {
  const t = Object.fromEntries(d.tags.map((x) => [x.tag, x]));
  assert.equal(t['P-1'].family, 'pump');
  assert.equal(t['HP-1'].family, 'panelboard');
  assert.equal(t['LP-1'].family, 'panelboard');
  assert.equal(t['CU-1'].family, 'hvac');
  assert.equal(t['LIT-1'].family, 'instrument');
  assert.equal(t['SCP-1'].family, 'controlpanel');
  assert.equal(t['DAV-1'].family, 'crane');
  assert.equal(t['ATS-1'].family, 'ats');
  assert.equal(t['T-1'].family, 'transformer');
});
check('tags: sheet references (E-7) flagged as sheet, not equipment', () => {
  const e7 = d.tags.find((x) => x.tag === 'E-7');
  assert.ok(e7 && e7.isSheet, 'E-7 should be flagged as a sheet reference');
});
check('values: bid due date and time parsed', () => {
  assert.equal(q.bidDue.value, '2026-10-14T14:00');
});
check('values: question deadline parsed', () => {
  assert.equal(q.questionsDeadline.value, '2026-10-06T17:00');
});
check('values: addenda 1, 2, 3 detected and acknowledgment flagged', () => {
  assert.deepEqual(v.addenda, [1, 2, 3]);
  assert.equal(v.addendumAcknowledge, true);
  assert.equal(q.addendaCount.value, 3);
});
check('values: AIS and SRF detected, BABA not asserted', () => {
  assert.equal(v.ais, true); assert.equal(v.srf, true); assert.equal(v.baba, false);
  assert.ok(q.funding.value.includes('American Iron and Steel (AIS)'));
  assert.ok(!q.funding.value.includes('Build America, Buy America (BABA)'));
});
check('values: kAIC conflict detected for panelboards (42 vs 65, 10 vs 22)', () => {
  const hi = v.kaicSummary.find((k) => k.context === 'panelboard 480 V');
  const lo = v.kaicSummary.find((k) => k.context === 'panelboard 208/240 V');
  assert.ok(hi && hi.conflict, '480 V panelboard kAIC conflict expected');
  assert.deepEqual(hi.distinct, [42, 65]);
  assert.ok(lo && lo.conflict, '208 V panelboard kAIC conflict expected');
  assert.deepEqual(lo.distinct, [10, 22]);
});
check('values: enclosure conflict (3R vs 4X) surfaces a question', () => {
  assert.ok(q.outdoorEnclosure, 'outdoorEnclosure question expected');
});
check('values: integrator named; manufacturers captured', () => {
  assert.equal(v.integratorNamed, true);
  assert.ok(v.manufacturers.some((m) => m.value === 'Cummins'));
  assert.ok(v.manufacturers.some((m) => /Flygt/.test(m.value)));
});
check('values: responsibility clauses captured', () => {
  assert.ok(v.responsibilityClauses.length >= 3, `got ${v.responsibilityClauses.length}`);
  assert.ok(v.responsibilityClauses.some((c) => /pump supplier/i.test(c.text)));
});
check('values: system voltage guessed 480Y/277', () => {
  assert.equal(q.systemVoltage.value, '480Y/277 V, 3-phase');
});

const items = Object.fromEntries(r1.takeoff.items.map((i) => [i.family, i]));
check('takeoff: VFD line quantity inferred from pump tags (2), distributor bucket', () => {
  assert.equal(items.vfd.qty, 2);
  assert.equal(items.vfd.bucket, 'distributor');
  assert.equal(items.vfd.confidence, 'Confirmed');
});
check('takeoff: panelboards counted from LP-1/HP-1 tags', () => {
  assert.equal(items.panelboard.qty, 2);
  assert.deepEqual(items.panelboard.tags.sort(), ['HP-1', 'LP-1']);
});
check('takeoff: transformer, ATS, generator, SPD, disconnects present', () => {
  assert.equal(items.transformer.qty, 1);
  assert.equal(items.ats.qty, 1);
  assert.equal(items.generator.qty, 1);
  assert.ok(items.spd);
  assert.ok(items.disconnect.qty >= 3, `disconnect qty ${items.disconnect.qty}`);
});
check('takeoff: control panel is integrator bucket when integrator named', () => {
  assert.equal(items.controlpanel.bucket, 'integrator');
  assert.ok(items.controlpanel.tags.includes('SCP-1'));
});
check('takeoff: pumps and HVAC are mechanical bucket; crane is package', () => {
  assert.equal(items.pump.bucket, 'mechanical');
  assert.equal(items.pump.qty, 2);
  assert.equal(items.hvac.bucket, 'mechanical');
  assert.equal(items.crane.bucket, 'package');
});
check('takeoff: installation material lines exist and are not quote units', () => {
  assert.equal(items.grounding.bucket, 'install');
  assert.equal(items.raceway.bucket, 'install');
  assert.equal(items.pads.bucket, 'install');
});
check('rfis: critical RFIs cover kAIC, FLA, lead length, pump package boundary', () => {
  const topics = r1.takeoff.rfis.map((r) => r.topic).join(' | ');
  assert.match(topics, /Interrupting rating conflict/);
  assert.match(topics, /Motor nameplate data/);
  assert.match(topics, /motor lead length/);
  assert.match(topics, /Pump package boundary/);
  assert.match(topics, /Outdoor enclosure type/);
  assert.ok(r1.takeoff.rfis.every((r) => /^RFI-\d{2}$/.test(r.id)));
  assert.deepEqual(r1.takeoff.rfis.map((r) => r.id), r1.takeoff.rfis.map((_, i) => `RFI-${String(i + 1).padStart(2, '0')}`), 'ids sequential after priority sort');
  const referenced = r1.takeoff.items.flatMap((i) => i.rfis);
  for (const id of referenced) assert.ok(r1.takeoff.rfis.some((r) => r.id === id), `item references missing ${id}`);
});
check('rfis: every RFI has a pricing basis', () => {
  for (const r of r1.takeoff.rfis) assert.ok(r.pricingBasis && r.pricingBasis.length > 10, r.id);
});
check('compliance: addendum acknowledgment, AIS, substitution deadline', () => {
  const c = r1.takeoff.compliance.map((x) => x.item).join(' | ');
  assert.match(c, /Acknowledge Addenda 1, 2, 3/);
  assert.match(c, /AIS certification/);
  assert.match(c, /10 days before bid/);
});
check('schedule: milestones ordered, bid-due last, RFI send before question deadline', () => {
  const ms = r1.schedule.milestones;
  assert.equal(ms[ms.length - 1].key, 'bid-due');
  const send = ms.find((m) => m.key === 'rfi-send');
  const qd = ms.find((m) => m.key === 'questions-deadline');
  assert.ok(send.when < qd.when);
  for (let i = 1; i < ms.length; i++) assert.ok(ms[i - 1].when <= ms[i].when);
});
check('ics: valid structure with alarms', () => {
  const ics = buildICS({ id: 'p1', name: 'Eastside PS' }, r1.schedule, r1.takeoff.rfis);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.ok((ics.match(/BEGIN:VEVENT/g) || []).length === r1.schedule.milestones.length);
  assert.match(ics, /BEGIN:VALARM/);
  assert.match(ics, /TRIGGER:-P1D/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
});
check('relevance: addendum pages always selected; char cap respected', () => {
  const sel = selectRelevantPages(docs.map((x, i) => ({ ...x })).map((x) => ({ ...x, pages: x.pages })), { maxChars: 2000 });
  assert.ok(sel.chars <= 2000);
  const full = selectRelevantPages(docs);
  assert.ok(full.pages.some((p) => p.doc === 'Addendum 3.pdf'));
});
check('renderers: markdown outputs contain headings and tables', () => {
  const rep = renderTakeoffReport({ name: 'Eastside PS' }, r1);
  assert.match(rep, /^# Eastside PS - Division 26 Takeoff Report/);
  assert.match(rep, /## Electrical distributor/);
  const rq = renderQuoteRequest({ name: 'Eastside PS' }, r1, 'distributor');
  assert.match(rq, /Variable-frequency drives/);
  const log = renderRfiLog({ name: 'Eastside PS' }, r1, { 'RFI-01': { sent: '2026-09-21' } });
  assert.match(log, /Sent 2026-09-21/);
  for (const b of Object.keys(BUCKETS)) assert.ok(renderQuoteRequest({ name: 'x' }, r1, b).length > 50);
});

// Pass 2: answers change the outcome.
const r2 = analyzeProject(docs, {
  integratorNamed: 'No - controls are under Division 26 or unassigned',
  vfdMounting: 'MCC-mounted VFD buckets',
  motorFLA: 'Nameplate FLA given on schedules',
  motorLeadLength: 'Known and under 100 ft',
  meteringBy: 'Utility furnishes metering equipment',
  drawingsIncluded: 'No - specifications only',
  generatorChannel: 'Generator dealer package directly',
}, { now: '2026-09-20T12:00:00' });
const items2 = Object.fromEntries(r2.takeoff.items.map((i) => [i.family, i]));
check('answers: integrator "No" moves control panel to ambiguous with critical RFI', () => {
  assert.equal(items2.controlpanel.bucket, 'ambiguous');
  assert.ok(r2.takeoff.rfis.some((r) => /Control panel \/ PLC/.test(r.topic) && r.priority === 'critical'));
});
check('answers: FLA and lead length known removes those RFIs', () => {
  const topics = r2.takeoff.rfis.map((r) => r.topic).join(' | ');
  assert.doesNotMatch(topics, /Motor nameplate data/);
  assert.doesNotMatch(topics, /motor lead length/);
});
check('answers: MCC-mounted VFDs carry MCC note', () => {
  assert.match(items2.vfd.channelNote, /inside the MCC lineup/);
});
check('answers: generator dealer channel moves generator to package bucket', () => {
  assert.equal(items2.generator.bucket, 'package');
});
check('answers: no drawings -> drawings RFI and TBD quantity basis', () => {
  assert.ok(r2.takeoff.rfis.some((r) => /Electrical drawings and schedules/.test(r.topic)));
});
check('answers: question values echo back', () => {
  const qq = Object.fromEntries(r2.questions.map((x) => [x.id, x.value]));
  assert.equal(qq.vfdMounting, 'MCC-mounted VFD buckets');
});

// Pass 3: empty input does not throw.
check('empty documents produce an empty but valid result', () => {
  const r = analyzeProject([{ name: 'blank', text: '' }], {});
  assert.equal(r.takeoff.items.length, 0);
  assert.ok(r.questions.find((x) => x.id === 'bidDue'));
  assert.equal(r.schedule.milestones.length, 0);
});

console.log(failures ? `\n${failures} failing` : '\nall tests passed');
process.exit(failures ? 1 : 0);
