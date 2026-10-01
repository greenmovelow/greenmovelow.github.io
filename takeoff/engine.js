/*
 * Division 26 Takeoff Workbench - analysis engine
 *
 * Pure ES module. No DOM access, so it runs in the browser and under Node
 * (scripts/test_takeoff_engine.js). Everything the UI shows is derived from
 * analyzeProject(); the UI only stores documents, answers, and overrides.
 *
 * Design rules carried over from the Q7716C / Fred Leroy takeoffs:
 *  - Never silently resolve a conflict. Preserve both values, pick a pricing
 *    basis, and raise an RFI.
 *  - Separate equipment units (quoted) from installation material (carried).
 *  - Every line item carries source evidence (document, page, snippet).
 *  - Confidence is explicit: Confirmed / Probable / Possible.
 */

export const ENGINE_VERSION = '0.1.0';

/* ------------------------------------------------------------------ */
/* Buckets: who quotes what                                            */
/* ------------------------------------------------------------------ */

export const BUCKETS = {
  distributor: {
    key: 'distributor',
    label: 'Electrical distributor',
    short: 'Distributor',
    description: 'Gear, drives, lighting and Division 26 equipment quoted by the electrical distributor or manufacturer representative.',
    order: 1,
  },
  mechanical: {
    key: 'mechanical',
    label: 'Mechanical / process equipment supplier',
    short: 'Mechanical',
    description: 'Division 22/23/43/44/46 equipment packages. Electrical scope is normally the power connection, disconnect and interface only.',
    order: 2,
  },
  integrator: {
    key: 'integrator',
    label: 'Systems integrator',
    short: 'Integrator',
    description: 'Division 40 controls: control panels, PLC/HMI, SCADA/telemetry, networks and most instrumentation.',
    order: 3,
  },
  package: {
    key: 'package',
    label: 'Other equipment package / specialty subcontractor',
    short: 'Package',
    description: 'Cranes, gates, fire alarm, communications, lightning protection and similar packages priced by a specialty supplier or sub.',
    order: 4,
  },
  install: {
    key: 'install',
    label: 'Installation material (contractor carry)',
    short: 'Install',
    description: 'Commodity material and labor carried by the electrical contractor: raceway, wire, grounding, pads, supports. Not an equipment quote unit.',
    order: 5,
  },
  ambiguous: {
    key: 'ambiguous',
    label: 'Ambiguous - resolve by RFI',
    short: 'Ambiguous',
    description: 'Furnish responsibility conflicts or is unstated. Carry as qualified until the RFI is answered.',
    order: 6,
  },
};

export const CONFIDENCE = ['Confirmed', 'Probable', 'Possible'];

export const RFI_PRIORITY = {
  critical: 'CRITICAL BEFORE PRICING',
  qualify: 'PRICE WITH QUALIFICATION',
  coordinate: 'COORDINATION / SUBMITTAL',
  compliance: 'BID COMPLIANCE',
};

/* ------------------------------------------------------------------ */
/* Section catalog (CSI MasterFormat, the sections that drive Div 26)  */
/* ------------------------------------------------------------------ */

export const SECTION_CATALOG = [
  // Division 00 / 01 - bid administration
  { code: '00 11 13', title: 'Advertisement for Bids', bucket: 'admin' },
  { code: '00 21 13', title: 'Instructions to Bidders', bucket: 'admin' },
  { code: '00 41 00', title: 'Bid Form', bucket: 'admin' },
  { code: '00 43 13', title: 'Bid Security Form', bucket: 'admin' },
  { code: '00 72 00', title: 'General Conditions', bucket: 'admin' },
  { code: '00 73 00', title: 'Supplementary Conditions', bucket: 'admin' },
  { code: '00 74 00', title: 'Federal / Funding Agency Requirements', bucket: 'admin' },
  { code: '00 91 13', title: 'Addenda', bucket: 'admin' },
  { code: '01 25 00', title: 'Substitution Procedures', bucket: 'admin' },
  { code: '01 28 00', title: 'Description of Work / Scope', bucket: 'admin' },
  { code: '01 33 00', title: 'Submittal Procedures', bucket: 'admin' },
  { code: '01 91 13', title: 'General Commissioning Requirements', bucket: 'admin' },
  // Division 22 / 23 - plumbing and HVAC
  { code: '22 05 13', title: 'Common Motor Requirements for Plumbing Equipment', bucket: 'mechanical', family: 'plumbing' },
  { code: '22 11 23', title: 'Domestic Water Pumps', bucket: 'mechanical', family: 'pump' },
  { code: '22 33 00', title: 'Electric Domestic Water Heaters', bucket: 'mechanical', family: 'plumbing' },
  { code: '23 05 13', title: 'Common Motor Requirements for HVAC Equipment', bucket: 'mechanical', family: 'hvac' },
  { code: '23 09 00', title: 'Instrumentation and Control for HVAC', bucket: 'mechanical', family: 'bas' },
  { code: '23 09 23', title: 'Direct-Digital Control System for HVAC', bucket: 'mechanical', family: 'bas' },
  { code: '23 09 93', title: 'Sequence of Operations for HVAC Controls', bucket: 'mechanical', family: 'bas' },
  { code: '23 21 23', title: 'Hydronic Pumps', bucket: 'mechanical', family: 'pump' },
  { code: '23 34 23', title: 'HVAC Power Ventilators', bucket: 'mechanical', family: 'hvac' },
  { code: '23 52 16', title: 'Condensing Boilers', bucket: 'mechanical', family: 'hvac' },
  { code: '23 74 13', title: 'Packaged Outdoor HVAC Units', bucket: 'mechanical', family: 'hvac' },
  { code: '23 81 26', title: 'Split-System Air-Conditioners', bucket: 'mechanical', family: 'hvac' },
  { code: '23 82 39', title: 'Unit Heaters', bucket: 'mechanical', family: 'hvac' },
  // Division 26 - electrical
  { code: '26 05 00', title: 'Common Work Results for Electrical', bucket: 'install' },
  { code: '26 05 13', title: 'Medium-Voltage Cables', bucket: 'distributor', family: 'mv' },
  { code: '26 05 19', title: 'Low-Voltage Electrical Power Conductors and Cables', bucket: 'install', family: 'wire' },
  { code: '26 05 26', title: 'Grounding and Bonding for Electrical Systems', bucket: 'install', family: 'grounding' },
  { code: '26 05 29', title: 'Hangers and Supports for Electrical Systems', bucket: 'install', family: 'supports' },
  { code: '26 05 33', title: 'Raceways and Boxes for Electrical Systems', bucket: 'install', family: 'raceway' },
  { code: '26 05 36', title: 'Cable Trays for Electrical Systems', bucket: 'install', family: 'raceway' },
  { code: '26 05 43', title: 'Underground Ducts and Raceways for Electrical Systems', bucket: 'install', family: 'ductbank' },
  { code: '26 05 53', title: 'Identification for Electrical Systems', bucket: 'install', family: 'identification' },
  { code: '26 05 73', title: 'Power System Studies', bucket: 'distributor', family: 'study' },
  { code: '26 08 00', title: 'Commissioning of Electrical Systems', bucket: 'admin' },
  { code: '26 09 13', title: 'Electrical Power Monitoring and Control', bucket: 'distributor', family: 'metering' },
  { code: '26 09 23', title: 'Lighting Control Devices', bucket: 'distributor', family: 'lightingcontrols' },
  { code: '26 09 43', title: 'Network Lighting Controls', bucket: 'distributor', family: 'lightingcontrols' },
  { code: '26 12 19', title: 'Pad-Mounted, Liquid-Filled, Medium-Voltage Transformers', bucket: 'distributor', family: 'mv' },
  { code: '26 13 00', title: 'Medium-Voltage Switchgear', bucket: 'distributor', family: 'mv' },
  { code: '26 22 00', title: 'Low-Voltage Transformers', bucket: 'distributor', family: 'transformer' },
  { code: '26 24 13', title: 'Switchboards', bucket: 'distributor', family: 'switchboard' },
  { code: '26 24 16', title: 'Panelboards', bucket: 'distributor', family: 'panelboard' },
  { code: '26 24 19', title: 'Motor-Control Centers', bucket: 'distributor', family: 'mcc' },
  { code: '26 27 13', title: 'Electricity Metering', bucket: 'ambiguous', family: 'metering' },
  { code: '26 27 26', title: 'Wiring Devices', bucket: 'install', family: 'devices' },
  { code: '26 28 13', title: 'Fuses', bucket: 'install', family: 'fuses' },
  { code: '26 28 16', title: 'Enclosed Switches and Circuit Breakers', bucket: 'distributor', family: 'disconnect' },
  { code: '26 29 13', title: 'Enclosed Controllers', bucket: 'distributor', family: 'starter' },
  { code: '26 29 23', title: 'Variable-Frequency Motor Controllers', bucket: 'distributor', family: 'vfd' },
  { code: '26 32 13', title: 'Engine Generators', bucket: 'distributor', family: 'generator' },
  { code: '26 33 53', title: 'Static Uninterruptible Power Supply', bucket: 'ambiguous', family: 'ups' },
  { code: '26 36 00', title: 'Transfer Switches', bucket: 'distributor', family: 'ats' },
  { code: '26 41 13', title: 'Lightning Protection for Structures', bucket: 'package', family: 'lightning' },
  { code: '26 43 00', title: 'Surge Protective Devices', bucket: 'distributor', family: 'spd' },
  { code: '26 51 00', title: 'Interior Lighting', bucket: 'distributor', family: 'lighting' },
  { code: '26 52 13', title: 'Emergency and Exit Lighting', bucket: 'distributor', family: 'lighting' },
  { code: '26 56 00', title: 'Exterior Lighting', bucket: 'distributor', family: 'lighting' },
  // Division 27 / 28 - communications, safety
  { code: '27 10 00', title: 'Structured Cabling', bucket: 'package', family: 'comms' },
  { code: '28 31 00', title: 'Fire Detection and Alarm', bucket: 'package', family: 'firealarm' },
  { code: '28 46 00', title: 'Fire Detection and Alarm', bucket: 'package', family: 'firealarm' },
  // Division 33 / 40 - utilities, process instrumentation and controls
  { code: '33 09 00', title: 'Instrumentation and Control for Utilities', bucket: 'integrator', family: 'controlpanel' },
  { code: '40 61 00', title: 'Process Control Systems', bucket: 'integrator', family: 'controlpanel' },
  { code: '40 63 00', title: 'Control System Equipment Panels and Racks', bucket: 'integrator', family: 'controlpanel' },
  { code: '40 66 00', title: 'Network and Communication Equipment', bucket: 'integrator', family: 'network' },
  { code: '40 67 00', title: 'Control System Equipment Panels and Racks', bucket: 'integrator', family: 'controlpanel' },
  { code: '40 70 00', title: 'Instrumentation for Process Systems', bucket: 'integrator', family: 'instrument' },
  { code: '40 71 00', title: 'Flow Measurement', bucket: 'integrator', family: 'instrument' },
  { code: '40 72 00', title: 'Level Measurement', bucket: 'integrator', family: 'instrument' },
  { code: '40 73 00', title: 'Pressure, Strain, and Force Measurement', bucket: 'integrator', family: 'instrument' },
  { code: '40 75 00', title: 'Process Liquid Analytical Measurement', bucket: 'integrator', family: 'instrument' },
  { code: '40 78 00', title: 'Panel Mounted Instruments', bucket: 'integrator', family: 'controlpanel' },
  { code: '40 90 00', title: 'Instrumentation and Control for Process Systems', bucket: 'integrator', family: 'controlpanel' },
  { code: '40 90 10', title: 'Process Controls and Devices', bucket: 'integrator', family: 'controlpanel' },
  { code: '40 91 00', title: 'Primary Process Measurement Devices', bucket: 'integrator', family: 'instrument' },
  { code: '40 94 00', title: 'Digital Process Controllers (PLC)', bucket: 'integrator', family: 'controlpanel' },
  { code: '40 95 00', title: 'Process Control Hardware', bucket: 'integrator', family: 'controlpanel' },
  // Division 41 / 43 / 44 / 46 - material handling, process equipment
  { code: '41 22 13', title: 'Cranes and Hoists', bucket: 'package', family: 'crane' },
  { code: '43 21 00', title: 'Liquid Pumps', bucket: 'mechanical', family: 'pump' },
  { code: '43 21 25', title: 'Submersible Pumps', bucket: 'mechanical', family: 'pump' },
  { code: '43 22 00', title: 'Liquid Process Equipment', bucket: 'mechanical', family: 'process' },
  { code: '43 23 00', title: 'Blowers and Compressors', bucket: 'mechanical', family: 'process' },
  { code: '43 24 00', title: 'Mixers', bucket: 'mechanical', family: 'process' },
  { code: '44 42 00', title: 'Water Treatment Equipment', bucket: 'mechanical', family: 'process' },
  { code: '46 05 00', title: 'Common Work Results for Water and Wastewater Equipment', bucket: 'mechanical', family: 'process' },
  { code: '46 21 00', title: 'Screening Equipment', bucket: 'mechanical', family: 'process' },
  { code: '46 25 00', title: 'Grit Removal Equipment', bucket: 'mechanical', family: 'process' },
  { code: '46 33 00', title: 'Chemical Feed Equipment', bucket: 'mechanical', family: 'process' },
  { code: '46 51 00', title: 'Aeration Equipment', bucket: 'mechanical', family: 'process' },
  { code: '46 71 00', title: 'Clarifier Equipment', bucket: 'mechanical', family: 'process' },
];

const DIVISION_TITLES = {
  '00': 'Procurement and Contracting Requirements',
  '01': 'General Requirements',
  '22': 'Plumbing',
  '23': 'HVAC',
  '26': 'Electrical',
  '27': 'Communications',
  '28': 'Electronic Safety and Security',
  '31': 'Earthwork',
  '33': 'Utilities',
  '40': 'Process Interconnections / Instrumentation and Control',
  '41': 'Material Processing and Handling Equipment',
  '43': 'Process Gas and Liquid Handling Equipment',
  '44': 'Pollution and Waste Control Equipment',
  '46': 'Water and Wastewater Equipment',
};

const DIVISION_DEFAULT_BUCKET = {
  '22': 'mechanical', '23': 'mechanical', '26': 'distributor', '27': 'package', '28': 'package',
  '33': 'integrator', '40': 'integrator', '41': 'package', '43': 'mechanical', '44': 'mechanical', '46': 'mechanical',
};

/* ------------------------------------------------------------------ */
/* Equipment families                                                  */
/* ------------------------------------------------------------------ */

/*
 * Each family describes one kind of thing the estimator has to decide about.
 *   patterns   - regexes that count as a hit
 *   tagPrefixes- equipment tag prefixes that belong to the family (P- for pumps)
 *   bucket     - default quote channel
 *   unit       - quantity unit
 *   quoteNote  - what the quoting party must be told
 *   electricalScope - what Division 26 still carries when the item is not
 *                a distributor unit (disconnect, feeder, interface)
 */
export const FAMILIES = [
  {
    key: 'vfd', label: 'Variable-frequency drives', category: 'Motor control',
    patterns: [/\bVFDs?\b/g, /variable[- ]frequency (?:drive|motor controller)/gi, /adjustable[- ](?:speed|frequency) drive/gi, /\bAFDs?\b/g, /\bASDs?\b/g],
    tagPrefixes: ['VFD', 'AFD'], bucket: 'distributor', unit: 'ea', section: '26 29 23',
    quoteNote: 'Size by motor nameplate FLA, not HP. State enclosure, SCCR, bypass, reactors/filters, communications and I/O.',
    electricalScope: 'Feeder, disconnect, control interface, startup coordination.',
  },
  {
    key: 'mcc', label: 'Motor control centers', category: 'Motor control',
    patterns: [/motor[- ]control cent(?:er|re)s?/gi, /\bMCCs?\b/g, /\bMCC-?\d/g],
    tagPrefixes: ['MCC'], bucket: 'distributor', unit: 'lineup', section: '26 24 19',
    quoteNote: 'Bucket schedule, bus rating, SCCR, section count, existing manufacturer compatibility if modifying.',
  },
  {
    key: 'switchboard', label: 'Switchboards / switchgear', category: 'Distribution',
    patterns: [/switchboards?/gi, /\bSWBD\b/g, /main distribution panel/gi, /\bMDP\b/g, /low[- ]voltage switchgear/gi, /service entrance (?:equipment|section)/gi],
    tagPrefixes: ['SWBD', 'MDP', 'MSB', 'SWGR', 'SES'], bucket: 'distributor', unit: 'ea', section: '26 24 13',
    quoteNote: 'Main rating, bus material, kAIC, section count, metering provisions, SPD.',
  },
  {
    key: 'panelboard', label: 'Panelboards', category: 'Distribution',
    patterns: [/panel\s?boards?/gi, /lighting (?:and appliance )?panel/gi, /distribution panel/gi, /power panel/gi],
    tagPrefixes: ['LP', 'HP', 'PP', 'DP', 'RP', 'EP', 'LDP', 'PNL'], tagPrefixExclusive: ['LP', 'HP', 'PP', 'DP', 'RP', 'EP', 'LDP', 'PNL'],
    bucket: 'distributor', unit: 'ea', section: '26 24 16',
    quoteNote: 'Main type and rating, voltage, bus material, circuit count, kAIC, enclosure, SPD, feed-through lugs.',
  },
  {
    key: 'transformer', label: 'Low-voltage dry-type transformers', category: 'Distribution',
    patterns: [/dry[- ]type transformers?/gi, /low[- ]voltage transformers?/gi, /\b\d{1,4}\s?kVA\b/g, /\bT-\d+\b/g, /\bXFMR/gi],
    tagPrefixes: ['T', 'XFMR', 'TX', 'TR'], bucket: 'distributor', unit: 'ea', section: '26 22 00',
    quoteNote: 'kVA, primary/secondary voltage, temperature rise, K-factor, taps, enclosure type, efficiency standard.',
  },
  {
    key: 'ats', label: 'Automatic transfer switches', category: 'Standby power',
    patterns: [/automatic transfer switch(?:es)?/gi, /\bATS\b/g, /transfer switch(?:es)?/gi],
    tagPrefixes: ['ATS'], bucket: 'distributor', unit: 'ea', section: '26 36 00',
    quoteNote: 'Amps, poles, transition type, service-entrance rating, WCR, bypass isolation, communications, SPD.',
  },
  {
    key: 'generator', label: 'Engine generators', category: 'Standby power',
    patterns: [/engine[- ]generators?/gi, /standby generators?/gi, /\bgensets?\b/gi, /diesel generators?/gi, /natural[- ]gas generators?/gi, /\bGEN-?\d/g, /\b\d{2,4}\s?kW\b(?=[^.]{0,80}generator)/gi],
    tagPrefixes: ['GEN', 'G'], tagPrefixExclusive: ['GEN'], bucket: 'distributor', unit: 'ea', section: '26 32 13',
    quoteNote: 'kW/kVA, voltage, fuel, enclosure/sound level, tank size, load-step performance, controls, ATS interface, startup/testing.',
    electricalScope: 'Feeders, ATS coordination, pad, fuel/permits per spec.',
    channelQuestion: true,
  },
  {
    key: 'spd', label: 'Surge protective devices', category: 'Distribution',
    patterns: [/surge protective devices?/gi, /\bSPDs?\b/g, /\bTVSS\b/g, /surge suppress/gi],
    tagPrefixes: ['SPD', 'TVSS'], bucket: 'distributor', unit: 'ea', section: '26 43 00',
    quoteNote: 'kA per mode, integral vs external, monitoring contacts, replaceable modules.',
  },
  {
    key: 'disconnect', label: 'Enclosed switches and circuit breakers', category: 'Distribution',
    patterns: [/disconnect switch(?:es)?/gi, /safety switch(?:es)?/gi, /enclosed (?:circuit )?breakers?/gi, /non-?fused disconnect/gi, /fused disconnect/gi, /\bDIS-/g, /\bDS-\d/g],
    tagPrefixes: ['DIS', 'DS', 'SW'], bucket: 'distributor', unit: 'ea', section: '26 28 16',
    quoteNote: 'Amps, poles, fused/nonfused, enclosure type, auxiliary contacts, VFD-output duty where applicable.',
  },
  {
    key: 'starter', label: 'Enclosed controllers and starters', category: 'Motor control',
    patterns: [/enclosed controllers?/gi, /combination starters?/gi, /magnetic starters?/gi, /\bFVNR\b/g, /\bFVR\b/g, /manual motor starters?/gi, /\bMMS\b/g, /soft[- ]start(?:er)?s?/gi, /reduced[- ]voltage (?:solid[- ]state )?start/gi],
    tagPrefixes: ['MS', 'STR', 'SS'], bucket: 'distributor', unit: 'ea', section: '26 29 13',
    quoteNote: 'NEMA size or amps, voltage, enclosure, pilot devices, overload type, control power.',
  },
  {
    key: 'metering', label: 'Utility metering and power monitoring', category: 'Distribution',
    patterns: [/utility meter(?:ing)?/gi, /metering cabinet/gi, /meter socket/gi, /\bCT cabinet/gi, /power (?:quality )?monitor/gi, /\bPQM\b/g, /revenue meter/gi],
    tagPrefixes: ['MTR', 'PQM'], bucket: 'ambiguous', unit: 'ea', section: '26 27 13',
    quoteNote: 'Utility-furnished versus contractor-furnished metering equipment must be confirmed with the utility.',
  },
  {
    key: 'lighting', label: 'Luminaires and lighting package', category: 'Lighting',
    patterns: [/luminaires?/gi, /light(?:ing)? fixtures?/gi, /fixture schedule/gi, /exit signs?/gi, /emergency (?:lighting|light(?:s)?)/gi, /pole[- ]mounted (?:light|fixture)/gi, /\bLED\b(?=[^.]{0,40}(?:fixture|luminaire|lamp))/gi],
    tagPrefixes: [], bucket: 'distributor', unit: 'package', section: '26 51 00',
    quoteNote: 'Quote from the fixture schedule. Identify basis-of-design, listed alternates, poles/bases, emergency battery packs, lead times.',
    channelQuestion: true,
  },
  {
    key: 'lightingcontrols', label: 'Lighting controls', category: 'Lighting',
    patterns: [/occupancy sensors?/gi, /vacancy sensors?/gi, /lighting control/gi, /photocells?/gi, /photo ?control/gi, /dimming/gi, /lighting relay panel/gi, /daylight(?:ing)? (?:sensor|control)/gi],
    tagPrefixes: ['LCP', 'OS'], tagPrefixExclusive: ['OS'], bucket: 'distributor', unit: 'system', section: '26 09 23',
    quoteNote: 'Sensor counts, relay panels, networked vs standalone, commissioning requirements.',
  },
  {
    key: 'ups', label: 'Uninterruptible power supply', category: 'Standby power',
    patterns: [/uninterruptible power/gi, /\bUPS\b/g],
    tagPrefixes: ['UPS'], bucket: 'ambiguous', unit: 'ea', section: '26 33 53',
    quoteNote: 'kVA, runtime, form factor, whether it lives inside the control panel (integrator) or is a loose Division 26 unit.',
  },
  {
    key: 'controlpanel', label: 'Control panels, PLC/HMI, SCADA and telemetry', category: 'Controls',
    patterns: [/control panels?/gi, /\bSCP-?\d?/g, /\bLCP-?\d/g, /\bMCP-?\d/g, /UL\s?508A/gi, /\bPLCs?\b/g, /\bHMIs?\b/g, /\bSCADA\b/g, /operator interface/gi, /PanelView/gi, /CompactLogix|ControlLogix|MicroLogix|Micro8\d0/gi, /telemetry/gi, /\bRTU\b(?![- ]?\d)/g, /remote terminal unit/gi, /programmable (?:logic )?controller/gi],
    tagPrefixes: ['SCP', 'LCP', 'MCP', 'CP', 'PLC', 'HMI', 'RCP', 'PCP'], bucket: 'integrator', unit: 'ea', section: '40 90 00',
    quoteNote: 'Integrator scope: panel fabrication, PLC/HMI hardware, programming, network, startup, demonstration, acceptance period.',
    electricalScope: '120 V power to panel, field wiring per the stated trade split, mounting.',
  },
  {
    key: 'network', label: 'Industrial network, radio and communications gear', category: 'Controls',
    patterns: [/industrial ethernet/gi, /managed (?:ethernet )?switch/gi, /fiber[- ]optic/gi, /\bradio(?:s)?\b(?=[^.]{0,60}(?:telemetry|SCADA|antenna))/gi, /cellular (?:modem|router|gateway)/gi, /\bModbus\b/g, /\bEtherNet\/IP\b/g, /\bPROFINET\b/g],
    tagPrefixes: ['ETH', 'NET'], bucket: 'integrator', unit: 'system', section: '40 66 00',
    quoteNote: 'Switch ports, fiber patching, radios/antennas, licensing, SCADA host integration.',
  },
  {
    key: 'instrument', label: 'Process instrumentation', category: 'Controls',
    patterns: [/flow ?meters?/gi, /magnetic flow/gi, /\bFIT-?\d/g, /\bFE-?\d/g, /\bFM-?\d/g, /\bLIT-?\d/g, /\bLT-?\d/g, /\bLSH{1,2}-?\d/g, /\bPIT-?\d/g, /\bPT-?\d/g, /level transducer/gi, /pressure transducer/gi, /pressure transmitter/gi, /ultrasonic level/gi, /radar level/gi, /float switch(?:es)?/gi, /analyzers?/gi, /dissolved oxygen/gi, /turbidity/gi, /chlorine (?:analyzer|residual)/gi, /\bpH\b(?=[^.]{0,40}(?:probe|sensor|analyzer|transmitter))/g],
    tagPrefixes: ['FIT', 'FE', 'FM', 'FT', 'LIT', 'LT', 'LSH', 'LSL', 'LSHH', 'LSLL', 'PIT', 'PT', 'PSH', 'PSL', 'AIT', 'AE', 'TIT', 'TT', 'FS', 'LS'], bucket: 'integrator', unit: 'ea', section: '40 70 00',
    quoteNote: 'Furnish/install/calibrate split between integrator, process supplier and electrical contractor must be stated.',
  },
  {
    key: 'pump', label: 'Pumps and pump packages', category: 'Process / mechanical equipment',
    patterns: [/submersible pumps?/gi, /\bpumps?\b/gi, /\bP-\d{1,3}\b/g, /\bHWP-?\d/g, /\bCHWP-?\d/g, /\bCWP-?\d/g, /\bBP-?\d/g, /\bRCP-?\d/g, /\bSP-?\d/g, /sump pump/gi, /booster pump/gi, /grinder pump/gi, /ejector/gi],
    tagPrefixes: ['P', 'HWP', 'CHWP', 'CWP', 'BP', 'RCP', 'SP', 'WP', 'SEP', 'FP'], bucket: 'mechanical', unit: 'ea', section: '43 21 00',
    quoteNote: 'Pump supplier furnishes pump, motor and protection relays; confirm whether controls/VFDs are in the pump package or Division 26.',
    electricalScope: 'Feeder, disconnect, VFD/starter unless packaged, moisture/temperature relay interface.',
  },
  {
    key: 'hvac', label: 'HVAC equipment', category: 'Process / mechanical equipment',
    patterns: [/\bHVAC\b/g, /air[- ]handling units?/gi, /\bAHU-?\d/g, /rooftop units?/gi, /\bRTU-\d/g, /exhaust fans?/gi, /\bEF-?\d/g, /supply fans?/gi, /\bSF-?\d/g, /condensing units?/gi, /\bCU-?\d/g, /fan[- ]coil/gi, /\bFCU-?\d/g, /unit heaters?/gi, /\bU?H-?\d/g, /\bEUH-?\d/g, /boilers?/gi, /\bB-\d\b/g, /chillers?/gi, /\bCH-?\d/g, /split[- ]system/gi, /mini[- ]split/gi, /ductless/gi, /make[- ]up air/gi, /\bMAU-?\d/g, /dehumidifier/gi, /\bERV-?\d/g, /\bHRV-?\d/g],
    tagPrefixes: ['AHU', 'RTU', 'EF', 'SF', 'RF', 'CU', 'ACCU', 'FCU', 'UH', 'EUH', 'B', 'CH', 'MAU', 'ERV', 'HRV', 'HP', 'DH', 'VAV', 'CUH', 'EH'], tagPrefixExclusive: ['AHU', 'RTU', 'EF', 'SF', 'RF', 'CU', 'ACCU', 'FCU', 'UH', 'EUH', 'CH', 'MAU', 'ERV', 'HRV', 'DH', 'VAV', 'CUH', 'EH'], bucket: 'mechanical', unit: 'ea', section: '23 05 13',
    quoteNote: 'Mechanical supplier furnishes packaged controls. Division 26 normally furnishes disconnects and power wiring; confirm starters/VFDs per schedule.',
    electricalScope: 'Disconnects, feeders, power connections; control wiring per Division 23 / TCC split.',
  },
  {
    key: 'bas', label: 'Building automation / temperature controls', category: 'Controls',
    patterns: [/building automation/gi, /\bBAS\b/g, /\bBMS\b/g, /\bDDC\b/g, /temperature control(?:s)? contractor/gi, /\bTCC\b/g, /energy management system/gi],
    tagPrefixes: [], bucket: 'mechanical', unit: 'system', section: '23 09 00',
    quoteNote: 'Temperature controls contractor scope; confirm control wiring and 120 V power responsibilities.',
  },
  {
    key: 'plumbing', label: 'Plumbing equipment with electrical connections', category: 'Process / mechanical equipment',
    patterns: [/water heaters?/gi, /\bE?WH-?\d/g, /circulat(?:or|ing) pump/gi, /\bDWH-?\d/g],
    tagPrefixes: ['WH', 'EWH', 'DWH'], bucket: 'mechanical', unit: 'ea', section: '22 05 13',
    quoteNote: 'Plumbing supplier package; Division 26 furnishes disconnect and power connection.',
  },
  {
    key: 'process', label: 'Process equipment packages (blowers, mixers, screens, chemical feed)', category: 'Process / mechanical equipment',
    patterns: [/blowers?/gi, /\bBLR-?\d/g, /mixers?/gi, /\bMX-?\d/g, /screens?(?=[^.]{0,30}(?:mechanical|bar|fine))/gi, /grit (?:removal|classifier)/gi, /chemical feed/gi, /metering pumps?/gi, /clarifier/gi, /aerat(?:or|ion) (?:equipment|system)/gi, /\bUV\b disinfection/gi, /sluice gate/gi, /actuator/gi, /\bMOV-?\d/g, /motor[- ]operated valve/gi],
    tagPrefixes: ['BLR', 'MX', 'SCR', 'MOV', 'AV', 'CF', 'CFP', 'AER'], bucket: 'mechanical', unit: 'ea', section: '46 05 00',
    quoteNote: 'Process supplier package; confirm whether local control panels and VFDs ship with the package.',
    electricalScope: 'Feeder, disconnect, interface wiring per package boundary.',
  },
  {
    key: 'crane', label: 'Cranes, hoists, davits', category: 'Other packages',
    patterns: [/jib cranes?/gi, /davit/gi, /hoists?/gi, /monorail/gi, /bridge cranes?/gi, /winch/gi],
    tagPrefixes: ['DAV', 'CR', 'HST'], bucket: 'package', unit: 'ea', section: '41 22 13',
    quoteNote: 'Crane supplier furnishes hoist starter, controls and pendant. Division 26 furnishes feeder and disconnect.',
    electricalScope: 'Feeder and disconnect only.',
  },
  {
    key: 'gate', label: 'Gate operators and access control', category: 'Other packages',
    patterns: [/gate operators?/gi, /motorized (?:security )?gate/gi, /sliding gate/gi, /access control/gi, /card readers?/gi, /keypad(?=[^.]{0,30}gate)/gi],
    tagPrefixes: [], bucket: 'package', unit: 'ea', section: '32 31 00',
    quoteNote: 'Gate package supplier; confirm electrical controller, voltage and load before carrying a circuit.',
  },
  {
    key: 'firealarm', label: 'Fire alarm', category: 'Other packages',
    patterns: [/fire alarm/gi, /\bFACP\b/g, /smoke detectors?/gi, /heat detectors?/gi, /notification appliance/gi],
    tagPrefixes: ['FACP', 'FA'], bucket: 'package', unit: 'system', section: '28 31 00',
    quoteNote: 'Fire alarm specialty subcontractor; Division 26 typically provides raceway and 120 V power.',
  },
  {
    key: 'comms', label: 'Structured cabling / telecommunications', category: 'Other packages',
    patterns: [/structured cabling/gi, /\bCAT\s?6A?\b/gi, /telecommunications? (?:room|outlet|cabling)/gi, /data outlets?/gi, /\bIDF\b/g, /\bMDF\b/g],
    tagPrefixes: [], bucket: 'package', unit: 'system', section: '27 10 00',
    quoteNote: 'Low-voltage/communications subcontractor.',
  },
  {
    key: 'lightning', label: 'Lightning protection', category: 'Other packages',
    patterns: [/lightning protection/gi, /air terminals?/gi],
    tagPrefixes: [], bucket: 'package', unit: 'system', section: '26 41 13',
    quoteNote: 'UL 96A listed installer / specialty sub.',
  },
  {
    key: 'mv', label: 'Medium-voltage equipment', category: 'Distribution',
    patterns: [/medium[- ]voltage/gi, /\b(?:4160|4\.16\s?kV|12\.47\s?kV|13\.2\s?kV|13\.8\s?kV|15\s?kV|25\s?kV)\b/g, /pad[- ]mount(?:ed)? transformer/gi, /primary metering/gi, /\bMV\b(?= (?:cable|switch|gear))/g],
    tagPrefixes: ['PMT', 'MVS'], bucket: 'distributor', unit: 'ea', section: '26 13 00',
    quoteNote: 'Long lead time. Confirm utility versus contractor furnish for pad-mounted transformers and primary metering.',
  },
  {
    key: 'solar', label: 'Photovoltaic / inverters', category: 'Distribution',
    patterns: [/photovoltaic/gi, /\bPV\b(?= (?:array|module|system|inverter))/g, /solar (?:array|module|panel)/gi],
    tagPrefixes: ['INV', 'PV'], bucket: 'distributor', unit: 'system', section: '26 31 00',
    quoteNote: 'Modules, inverters, racking, rapid shutdown, interconnection; may be a specialty package.',
  },
  {
    key: 'ev', label: 'EV charging', category: 'Distribution',
    patterns: [/\bEV charg/gi, /\bEVSE\b/g, /electric vehicle/gi],
    tagPrefixes: ['EVSE', 'EVC'], bucket: 'distributor', unit: 'ea', section: '26 27 19',
    quoteNote: 'Charger level, networked or not, pedestal, load management.',
  },
  {
    key: 'heattrace', label: 'Heat tracing', category: 'Distribution',
    patterns: [/heat[- ]trac(?:e|ing)/gi, /freeze protection (?:cable|heater)/gi, /self[- ]regulating (?:heating )?cable/gi],
    tagPrefixes: ['HT'], bucket: 'distributor', unit: 'system', section: '26 05 33', // often 23 05 33
    quoteNote: 'Footage from mechanical drawings, controllers, power connection kits; confirm Division 22/23 versus 26 furnish.',
  },
  {
    key: 'study', label: 'Power system studies (short-circuit, coordination, arc-flash)', category: 'Engineering services',
    patterns: [/coordination stud(?:y|ies)/gi, /arc[- ]flash/gi, /short[- ]circuit stud(?:y|ies)/gi, /power system stud(?:y|ies)/gi, /selective coordination/gi],
    tagPrefixes: [], bucket: 'distributor', unit: 'study', section: '26 05 73',
    quoteNote: 'Usually performed by the distribution-equipment manufacturer or an independent engineer; include in the gear quote request.',
  },
  // Installation material families (contractor carry)
  {
    key: 'wire', label: 'Conductors and cable', category: 'Installation material',
    patterns: [/\bTHHN\b/g, /\bTHWN(?:-2)?\b/g, /\bXHHW(?:-2)?\b/g, /\bMC cable\b/gi, /\bVFD cable\b/gi, /shielded (?:VFD |motor )?cable/gi, /conductors? and cables?/gi],
    tagPrefixes: [], bucket: 'install', unit: 'lot', section: '26 05 19',
  },
  {
    key: 'raceway', label: 'Raceway, boxes and fittings', category: 'Installation material',
    patterns: [/\bconduits?\b/gi, /raceways?/gi, /\bEMT\b/g, /\bRMC\b/g, /\bIMC\b/g, /\bPVC\b(?=[^.]{0,30}(?:conduit|schedule|raceway))/g, /\bLFMC\b/g, /pull box(?:es)?/gi, /junction box(?:es)?/gi, /cable tray/gi, /wireway/gi],
    tagPrefixes: [], bucket: 'install', unit: 'lot', section: '26 05 33',
  },
  {
    key: 'grounding', label: 'Grounding and bonding', category: 'Installation material',
    patterns: [/ground(?:ing)? (?:rods?|rings?|electrodes?|grids?)/gi, /\bbonding\b/gi, /grounding and bonding/gi, /exothermic/gi],
    tagPrefixes: [], bucket: 'install', unit: 'lot', section: '26 05 26',
  },
  {
    key: 'ductbank', label: 'Underground ducts, manholes, handholes', category: 'Installation material',
    patterns: [/duct\s?banks?/gi, /underground (?:ducts?|raceways?)/gi, /manholes?/gi, /handholes?/gi, /concrete[- ]encased/gi],
    tagPrefixes: ['MH', 'HH'], bucket: 'install', unit: 'lot', section: '26 05 43',
  },
  {
    key: 'pads', label: 'Housekeeping pads and equipment supports', category: 'Installation material',
    patterns: [/housekeeping pads?/gi, /concrete pads?/gi, /equipment pads?/gi, /unistrut|strut channel/gi],
    tagPrefixes: [], bucket: 'install', unit: 'ea', section: '26 05 29',
  },
  {
    key: 'devices', label: 'Wiring devices', category: 'Installation material',
    patterns: [/receptacles?/gi, /wiring devices?/gi, /\bGFCI\b/g, /\bGFI\b/g, /switch(?:es)?(?=[^.]{0,20}(?:toggle|20 ?A|wall))/gi],
    tagPrefixes: [], bucket: 'install', unit: 'lot', section: '26 27 26',
  },
];

const FAMILY_BY_KEY = Object.fromEntries(FAMILIES.map((f) => [f.key, f]));

/* ------------------------------------------------------------------ */
/* Manufacturer names worth surfacing in a quote request               */
/* ------------------------------------------------------------------ */

export const MANUFACTURERS = [
  ['Square D', /\bSquare\s?D\b/gi, 'gear'], ['Schneider Electric', /\bSchneider\b/gi, 'gear'], ['Eaton', /\bEaton\b/g, 'gear'],
  ['Cutler-Hammer', /\bCutler[- ]Hammer\b/gi, 'gear'], ['Siemens', /\bSiemens\b/g, 'gear'], ['ABB', /\bABB\b/g, 'gear'],
  ['General Electric', /\bGeneral Electric\b|\bGE\b(?= (?:panel|breaker|switch|gear))/g, 'gear'],
  ['Allen-Bradley / Rockwell', /\bAllen[- ]Bradley\b|\bRockwell\b/gi, 'drives/controls'], ['Danfoss', /\bDanfoss\b/g, 'drives'],
  ['Yaskawa', /\bYaskawa\b/g, 'drives'], ['Toshiba', /\bToshiba\b/g, 'drives'], ['Hitachi', /\bHitachi\b/g, 'drives'],
  ['Cummins', /\bCummins\b/g, 'generator'], ['Kohler', /\bKohler\b/g, 'generator'], ['Generac', /\bGenerac\b/g, 'generator'],
  ['Caterpillar', /\bCaterpillar\b|\bCAT\b(?= (?:generator|genset))/g, 'generator'], ['MTU', /\bMTU\b/g, 'generator'],
  ['ASCO', /\bASCO\b/g, 'ats'], ['Russelectric', /\bRusselectric\b/g, 'ats'], ['Zenith', /\bZenith\b/g, 'ats'],
  ['Emerson / Rosemount', /\bRosemount\b|\bEmerson\b/g, 'instruments'], ['Endress+Hauser', /\bEndress\b/g, 'instruments'],
  ['Krohne', /\bKrohne\b/g, 'instruments'], ['Yokogawa', /\bYokogawa\b/g, 'instruments'], ['Hach', /\bHach\b/g, 'instruments'],
  ['Flygt / Xylem', /\bFlygt\b|\bXylem\b/g, 'pumps'], ['KSB', /\bKSB\b/g, 'pumps'], ['Gorman-Rupp', /\bGorman[- ]Rupp\b/gi, 'pumps'],
  ['Grundfos', /\bGrundfos\b/g, 'pumps'], ['Bell & Gossett', /\bBell\s?&\s?Gossett\b|\bB&G\b/g, 'pumps'], ['Fairbanks', /\bFairbanks\b/g, 'pumps'],
  ['Lithonia / Acuity', /\bLithonia\b|\bAcuity\b/g, 'lighting'], ['Cooper Lighting', /\bCooper\b(?= Lighting)/g, 'lighting'], ['Cree', /\bCree\b/g, 'lighting'],
  ['Hoffman / nVent', /\bHoffman\b|\bnVent\b/g, 'enclosures'], ['N-Tron / Red Lion', /\bN-Tron\b|\bRed Lion\b/g, 'network'],
  ['Phoenix Contact', /\bPhoenix Contact\b/g, 'controls'], ['Mitsubishi Electric', /\bMitsubishi\b/g, 'hvac/drives'],
  ['Greenheck', /\bGreenheck\b/g, 'hvac'], ['Trane', /\bTrane\b/g, 'hvac'], ['Carrier', /\bCarrier\b(?= (?:unit|rooftop|model))/g, 'hvac'],
  ['Thern', /\bThern\b/g, 'cranes'], ['Halliday', /\bHalliday\b/g, 'access hatches'],
];

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec';
const DATE_RE = new RegExp(`(?:(?:${MONTHS})\\.?\\s+\\d{1,2},?\\s+\\d{4})|(?:\\d{1,2}\\/\\d{1,2}\\/\\d{2,4})|(?:\\d{4}-\\d{2}-\\d{2})`, 'gi');
const TIME_RE = /\b(\d{1,2})(?::(\d{2}))?\s?([ap])\.?\s?m\.?\b/gi;

function normalizeSpace(s) {
  return String(s || '').replace(/[\u00a0\t]+/g, ' ').replace(/ {2,}/g, ' ');
}

function snippet(text, index, len, radius = 110) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + len + radius);
  let s = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) s = '\u2026' + s;
  if (end < text.length) s = s + '\u2026';
  return s;
}

function sentences(text) {
  return normalizeSpace(text).split(/(?<=[.;:])\s+(?=[A-Z0-9])|\n{2,}/).map((s) => s.trim()).filter(Boolean);
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

function parseDateLoose(str) {
  if (!str) return null;
  const d = new Date(str.replace(/(\d)(st|nd|rd|th)/g, '$1').replace(/Sept\b/, 'Sep'));
  return Number.isNaN(d.getTime()) ? null : d;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function toICSDate(date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`;
}

function icsEscape(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/* ------------------------------------------------------------------ */
/* Document model                                                      */
/* ------------------------------------------------------------------ */

/**
 * Normalise a document into { id, name, role, pages:[{n,text}], text }.
 * Accepts either pages or a single text blob (treated as one page).
 */
export function normalizeDocument(doc, index = 0) {
  const pages = Array.isArray(doc.pages) && doc.pages.length
    ? doc.pages.map((p, i) => ({ n: p.n ?? i + 1, text: String(p.text || '') }))
    : [{ n: 1, text: String(doc.text || '') }];
  return {
    id: doc.id || `doc-${index + 1}`,
    name: doc.name || `Document ${index + 1}`,
    role: doc.role || 'spec',
    sha256: doc.sha256 || null,
    pages,
    text: pages.map((p) => p.text).join('\n\f\n'),
    chars: pages.reduce((a, p) => a + p.text.length, 0),
  };
}

function eachPage(docs, fn) {
  for (const doc of docs) for (const page of doc.pages) fn(doc, page);
}

function findAll(re, text) {
  const out = [];
  re.lastIndex = 0;
  let m;
  const flags = re.flags.includes('g') ? re : new RegExp(re.source, re.flags + 'g');
  while ((m = flags.exec(text)) !== null) {
    out.push({ index: m.index, match: m[0], groups: m.slice(1) });
    if (m[0].length === 0) flags.lastIndex++;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Detection passes                                                    */
/* ------------------------------------------------------------------ */

const SECTION_RE = /\b(\d{2})\s?(\d{2})\s?(\d{2})(?:\.(\d{2}))?\b(?:\s*[-\u2013:]?\s*([A-Z][A-Z0-9 ,&/()\-']{6,80}))?/g;
const DIVISIONS_OF_INTEREST = new Set(['00', '01', '22', '23', '26', '27', '28', '31', '33', '40', '41', '43', '44', '46']);

function catalogLookup(code) {
  // Exact first, then prefix on the first 5 chars ("26 24"), then division.
  const exact = SECTION_CATALOG.find((s) => s.code === code);
  if (exact) return exact;
  const div = code.slice(0, 2);
  const near = SECTION_CATALOG.find((s) => s.code.slice(0, 5) === code.slice(0, 5));
  if (near) return { ...near, code, title: near.title, inferred: true };
  return { code, title: `${DIVISION_TITLES[div] || 'Division ' + div} (section ${code})`, bucket: DIVISION_DEFAULT_BUCKET[div] || 'unknown', inferred: true };
}

export function detectSections(docs) {
  const map = new Map();
  eachPage(docs, (doc, page) => {
    for (const hit of findAll(SECTION_RE, page.text)) {
      const [a, b, c, sub, title] = hit.groups;
      if (!DIVISIONS_OF_INTEREST.has(a)) continue;
      // Reject obvious non-section numerics (dates like 07 29 26 near "Bid" are rare; phone/zip fragments are filtered by division set).
      if (a === '00' && b === '00') continue;
      const code = `${a} ${b} ${c}${sub ? '.' + sub : ''}`;
      const entry = map.get(code) || { code, count: 0, pages: [], titles: [], docs: new Set() };
      entry.count++;
      entry.docs.add(doc.name);
      if (entry.pages.length < 40) entry.pages.push({ doc: doc.name, page: page.n });
      if (title && title.trim().length > 6 && entry.titles.length < 5) entry.titles.push(title.trim());
      map.set(code, entry);
    }
  });
  const out = [];
  for (const e of map.values()) {
    const cat = catalogLookup(e.code);
    // Prefer a title printed in the document (most frequent), fall back to catalog.
    const docTitle = mostCommon(e.titles.map((t) => t.replace(/\s{2,}/g, ' ').replace(/[ ,\-\u2013]+$/, '')));
    out.push({
      code: e.code,
      division: e.code.slice(0, 2),
      title: docTitle || cat.title,
      catalogTitle: cat.title,
      bucket: cat.bucket,
      family: cat.family || null,
      count: e.count,
      pages: e.pages,
      docs: Array.from(e.docs),
      dedicatedSection: e.count >= 3, // repeated header/footer usually means the section itself is present
    });
  }
  return out.sort((x, y) => x.code.localeCompare(y.code));
}

function mostCommon(list) {
  if (!list.length) return null;
  const counts = new Map();
  for (const x of list) counts.set(x, (counts.get(x) || 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

const TAG_RE = /\b([A-Z]{1,5})-((?:[A-Z]{1,4}-?)?\d{1,3}[A-Z]?)\b/g;
const TAG_BLACKLIST = new Set(['NEMA', 'UL', 'IEEE', 'ANSI', 'ASTM', 'NFPA', 'ISO', 'OSHA', 'SCCR', 'THHN', 'XHHW', 'EMT', 'PVC', 'RMC', 'SS', 'AWG', 'MCM', 'RPM', 'VAC', 'VDC', 'AC', 'DC', 'CFM', 'GPM', 'PSI', 'TDH', 'BTU', 'OD', 'ID', 'NPT', 'FLA', 'MCA', 'MOCP', 'HP', 'KW', 'KVA', 'KA', 'A', 'V', 'W', 'C', 'F', 'E', 'M', 'S', 'D', 'X', 'Y', 'Z', 'PH', 'NO', 'NC', 'CT', 'PT', 'ATS', 'MCC', 'VFD']);
// Note: ATS/MCC/VFD/CT/PT stay in the blacklist as bare abbreviations; hyphenated numbered forms are re-admitted below.
const TAG_REALLOW = new Set(['ATS', 'MCC', 'VFD', 'PT', 'CT', 'HP', 'E', 'M', 'S', 'C', 'P', 'T', 'B', 'G']);

export function detectTags(docs) {
  const tags = new Map();
  eachPage(docs, (doc, page) => {
    for (const hit of findAll(TAG_RE, page.text)) {
      const [prefix, num] = hit.groups;
      if (TAG_BLACKLIST.has(prefix) && !TAG_REALLOW.has(prefix)) continue;
      // Drawing sheet numbers (E-1, M-3, S-10, C-39) are not equipment: record separately.
      const tag = `${prefix}-${num}`;
      const isSheet = /^[ECMSPAGDHIL]$/.test(prefix) && /^\d{1,3}$/.test(num) && /sheet|drawing|dwg|see |per |refer/i.test(snippet(page.text, hit.index, hit.match.length, 30));
      const entry = tags.get(tag) || { tag, prefix, num, count: 0, evidence: [], isSheet: false };
      entry.count++;
      if (isSheet) entry.isSheet = true;
      if (entry.evidence.length < 6) entry.evidence.push({ doc: doc.name, page: page.n, snippet: snippet(page.text, hit.index, hit.match.length, 80) });
      tags.set(tag, entry);
    }
  });
  const list = Array.from(tags.values());
  for (const t of list) t.family = familyForPrefix(t.prefix);
  return list.filter((t) => t.count >= 1).sort((a, b) => b.count - a.count);
}

function familyForPrefix(prefix) {
  // Exclusive prefixes win (LP/HP -> panelboard, EF -> hvac), then the first
  // family that lists the prefix. Bare "P-n" is a pump on process work and a
  // panel on building work; the takeoff builder re-checks that case.
  for (const f of FAMILIES) if (f.tagPrefixExclusive && f.tagPrefixExclusive.includes(prefix)) return f.key;
  for (const f of FAMILIES) if (f.tagPrefixes && f.tagPrefixes.includes(prefix)) return f.key;
  return null;
}

export function detectFamilies(docs) {
  const results = [];
  for (const fam of FAMILIES) {
    let count = 0;
    const evidence = [];
    const pages = new Set();
    eachPage(docs, (doc, page) => {
      for (const re of fam.patterns) {
        const hits = findAll(re, page.text);
        count += hits.length;
        for (const h of hits) {
          pages.add(`${doc.name}#${page.n}`);
          if (evidence.length < 8) evidence.push({ doc: doc.name, page: page.n, snippet: snippet(page.text, h.index, h.match.length) });
        }
      }
    });
    if (count > 0) results.push({ key: fam.key, label: fam.label, category: fam.category, count, pages: pages.size, evidence });
  }
  return results.sort((a, b) => b.count - a.count);
}

export function detectValues(docs) {
  const v = {
    voltages: new Map(), kaic: [], enclosures: new Map(), hp: [], kva: [], kw: [], amps: new Map(),
    hasFLA: false, hasMCA: false, leadLength: [], dvdt: false, outputReactor: false, lineReactor: false, harmonics: false, bypass: false, sccr: false,
    ais: false, baba: false, buyAmerican: false, davisBacon: false, srf: false, orEqual: false, noSubstitution: false, substitutionDeadline: [],
    bidDue: [], questionsDeadline: [], addenda: new Set(), addendumAcknowledge: false, preBid: [], integratorNamed: false, integratorClauses: [], tccNamed: false,
    responsibilityClauses: [], manufacturers: new Map(), existingMCC: false, existingEquipment: false, hazardous: false, aicConflictContexts: [],
    projectTitle: null, owner: null, engineer: null, projectNumber: null, bidNumber: null,
  };
  const push = (map, key, ev) => { const e = map.get(key) || { value: key, count: 0, evidence: [] }; e.count++; if (e.evidence.length < 4) e.evidence.push(ev); map.set(key, e); };

  eachPage(docs, (doc, page) => {
    const t = page.text;
    const ev = (idx, len) => ({ doc: doc.name, page: page.n, snippet: snippet(t, idx, len) });

    for (const h of findAll(/\b(480Y\/277|480\/277|277\/480|208Y\/120|208\/120|120\/208|120\/240|240\/120|480|208|240|600|4160|2400|12\.47\s?kV|13\.2\s?kV|13\.8\s?kV)\s?V?(?:olts?|AC)?\b/gi, t)) {
      const raw = h.groups[0].toUpperCase().replace(/\s/g, '');
      if (/^(240|208|480|600)$/.test(raw) && !/\bV/i.test(h.match)) continue; // bare numbers need a V
      push(v.voltages, raw, ev(h.index, h.match.length));
    }
    for (const h of findAll(/\b(\d{2,3})\s?k\s?A(?:IC)?\b(?!\/)/gi, t)) {
      const ctx = snippet(t, h.index, h.match.length, 90);
      if (/surge|SPD|TVSS|per (?:phase|mode)|L-N|L-G|kA\/phase|kA per/i.test(ctx) && !/interrupt|AIC|withstand|fault|symmetrical|SCCR/i.test(ctx)) continue; // surge kA, not fault kA
      v.kaic.push({ value: Number(h.groups[0]), doc: doc.name, page: page.n, snippet: ctx, context: classifyKaContext(ctx, nearestVoltageClass(t, h.index)) });
    }
    for (const h of findAll(/\b(?:NEMA|Type)\s?(1|2|3R|3RX|3|4X|4|12|12K|13|7|9)\b/g, t)) {
      push(v.enclosures, h.groups[0].toUpperCase(), ev(h.index, h.match.length));
    }
    for (const h of findAll(/\b(\d{1,4}(?:\.\d+)?|\d\/\d)\s?-?\s?HP\b/g, t)) {
      if (v.hp.length < 200) v.hp.push({ value: h.groups[0], doc: doc.name, page: page.n, snippet: snippet(t, h.index, h.match.length, 60) });
    }
    for (const h of findAll(/\b(\d{1,4}(?:\.\d+)?)\s?kVA\b/gi, t)) {
      if (v.kva.length < 100) v.kva.push({ value: Number(h.groups[0]), doc: doc.name, page: page.n, snippet: snippet(t, h.index, h.match.length, 60) });
    }
    for (const h of findAll(/\b(\d{2,4})\s?kW\b(?=[^.\n]{0,80}(?:generator|genset|standby|emergency))/gi, t)) {
      if (v.kw.length < 50) v.kw.push({ value: Number(h.groups[0]), doc: doc.name, page: page.n, snippet: snippet(t, h.index, h.match.length, 60) });
    }
    for (const h of findAll(/\b(\d{2,4})\s?A(?:mp(?:ere)?s?)?\b(?=[^.\n]{0,30}(?:main|MCB|MLO|bus|frame|feeder|breaker|switch|disconnect|ATS|service))/gi, t)) {
      push(v.amps, h.groups[0], ev(h.index, h.match.length));
    }
    if (/\bFLA\b|full[- ]load (?:amp|current)/i.test(t)) v.hasFLA = true;
    if (/\bMCA\b|minimum circuit amp/i.test(t)) v.hasMCA = true;
    for (const h of findAll(/(?:motor|cable|conductor|lead)s?[- ](?:lead\s?)?length[^.\n]{0,80}|(?:exceed|greater than|more than|over)\s+(\d{2,4})\s?(?:feet|ft|')(?=[^.\n]{0,60}(?:motor|drive|VFD|lead))/gi, t)) {
      if (v.leadLength.length < 10) v.leadLength.push(ev(h.index, h.match.length));
    }
    if (/dv\/dt|dV\/dt|sine[- ]?wave filter/i.test(t)) v.dvdt = true;
    if (/output (?:load )?reactor|load reactor|motor reactor/i.test(t)) v.outputReactor = true;
    if (/line reactor|input reactor|\b\d\s?% (?:impedance )?reactor/i.test(t)) v.lineReactor = true;
    if (/IEEE\s?519|harmonic (?:mitigation|distortion|filter)|\bTHD\b|18[- ]pulse|active front end|\bAFE\b/i.test(t)) v.harmonics = true;
    if (/\bbypass\b/i.test(t) && /VFD|drive|controller/i.test(t)) v.bypass = true;
    if (/\bSCCR\b|short[- ]circuit current rating/i.test(t)) v.sccr = true;
    if (/American Iron and Steel|\bAIS\b(?=[^.\n]{0,60}(?:compliance|requirement|certif|iron|steel))/i.test(t)) v.ais = true;
    if (/Build America,? Buy America|\bBABA\b/i.test(t)) v.baba = true;
    if (/Buy American/i.test(t)) v.buyAmerican = true;
    if (/Davis[- ]Bacon|prevailing wage/i.test(t)) v.davisBacon = true;
    if (/\bSRF\b|State Revolving Fund|\bCWSRF\b|\bDWSRF\b|\bUSDA\b|Rural Development|\bEPA\b grant/i.test(t)) v.srf = true;
    if (/\bor (?:approved )?equal\b|or approved equivalent/i.test(t)) v.orEqual = true;
    if (/no substitution|substitutions? (?:will|shall) not be (?:accepted|considered|permitted)/i.test(t)) v.noSubstitution = true;
    for (const h of findAll(/(?:substitution|prior approval|pre-?approval|approved equal)[^.\n]{0,120}?(\d{1,2})\s+(?:calendar |business |working )?days?\s+(?:prior to|before)[^.\n]{0,40}(?:bid|opening)/gi, t)) {
      if (v.substitutionDeadline.length < 4) v.substitutionDeadline.push({ days: Number(h.groups[0]), ...ev(h.index, h.match.length) });
    }
    if (/\bexisting\s+(?:MCC|motor control center)/i.test(t)) v.existingMCC = true;
    if (/\bexisting\s+(?:panel|switchboard|switchgear|equipment|generator|transformer)/i.test(t)) v.existingEquipment = true;
    if (/Class\s?[I1],?\s?Division\s?[12]|hazardous \(classified\) location|explosion[- ]proof|NEC 500|NFPA 820/i.test(t)) v.hazardous = true;
    if (/systems? integrator|control systems? integrator|instrumentation and controls? (?:sub)?contractor|\bICSC\b|\bSI\b shall/i.test(t)) {
      v.integratorNamed = true;
      for (const s of sentences(t)) if (/integrator|ICSC/i.test(s) && /shall|responsib|furnish|provide|supply/i.test(s) && v.integratorClauses.length < 12) v.integratorClauses.push({ doc: doc.name, page: page.n, text: s.slice(0, 400) });
    }
    if (/temperature controls? contractor|\bTCC\b|controls contractor|BAS contractor/i.test(t)) v.tccNamed = true;

    // Responsibility clauses: who furnishes / installs what.
    for (const s of sentences(t)) {
      if (/(furnish(?:ed)?|provid(?:ed)?|install(?:ed)?|suppl(?:y|ied)|wired|programmed)\s+(?:and (?:installed|wired|connected) )?(?:by|under)\s+(?:the\s+)?(Division\s?\d{2}|(?:mechanical|electrical|general|plumbing|HVAC|controls?) (?:sub)?contractor|systems? integrator|(?:pump|equipment|generator|crane|VFD|drive|process|HVAC) (?:supplier|manufacturer|vendor)|owner|utility(?: company)?|others)/i.test(s) && v.responsibilityClauses.length < 60) {
        v.responsibilityClauses.push({ doc: doc.name, page: page.n, text: s.slice(0, 420) });
      }
    }

    // Bid administration.
    for (const s of sentences(t)) {
      if (/\b(bids?|proposals?)\b/i.test(s) && /\b(received|due|open(?:ed|ing)|accepted)\b/i.test(s) && DATE_RE.test(s)) {
        DATE_RE.lastIndex = 0;
        const dates = findAll(DATE_RE, s).map((d) => d.match);
        TIME_RE.lastIndex = 0;
        const times = findAll(TIME_RE, s).map((x) => x.match);
        if (v.bidDue.length < 6) v.bidDue.push({ dates, times, doc: doc.name, page: page.n, text: s.slice(0, 400) });
      }
      DATE_RE.lastIndex = 0;
      if (/\b(questions?|inquir(?:y|ies)|interpretations?|clarifications?|requests? for information|RFIs?)\b/i.test(s) && /\b(submitted|received|due|deadline|no later than|prior to|before)\b/i.test(s) && (DATE_RE.test(s) || /\d+\s+(?:calendar |business |working )?days/i.test(s))) {
        DATE_RE.lastIndex = 0;
        const dates = findAll(DATE_RE, s).map((d) => d.match);
        const days = (s.match(/(\d+)\s+(?:calendar |business |working )?days/i) || [])[1];
        if (v.questionsDeadline.length < 6) v.questionsDeadline.push({ dates, daysBefore: days ? Number(days) : null, doc: doc.name, page: page.n, text: s.slice(0, 400) });
      }
      DATE_RE.lastIndex = 0;
      if (/pre-?bid (?:meeting|conference)/i.test(s) && DATE_RE.test(s) && v.preBid.length < 3) {
        DATE_RE.lastIndex = 0;
        v.preBid.push({ dates: findAll(DATE_RE, s).map((d) => d.match), doc: doc.name, page: page.n, text: s.slice(0, 300) });
      }
      DATE_RE.lastIndex = 0;
    }
    for (const h of findAll(/Addendum\s+(?:No\.?\s*)?(\d{1,2})\b/gi, t)) v.addenda.add(Number(h.groups[0]));
    if (/acknowledg\w*[^.\n]{0,60}addend/i.test(t)) v.addendumAcknowledge = true;

    for (const [name, re] of MANUFACTURERS) {
      const hits = findAll(re, t);
      if (hits.length) push(v.manufacturers, name, ev(hits[0].index, hits[0].match.length));
    }

    if (!v.projectTitle) {
      const m = t.match(/(?:PROJECT|Project)\s*(?:Title|Name)?\s*[:\-]\s*([^\n]{6,120})/);
      if (m) v.projectTitle = m[1].trim();
    }
    if (!v.owner) {
      const m = t.match(/\b(?:OWNER|Owner)\s*[:\-]\s*([^\n]{3,100})/);
      if (m) v.owner = m[1].trim();
    }
    if (!v.engineer) {
      const m = t.match(/\b(?:ENGINEER|Engineer)\s*[:\-]\s*([^\n]{3,100})/);
      if (m) v.engineer = m[1].trim();
    }
    if (!v.projectNumber) {
      const m = t.match(/\bProject\s+(?:No\.?|Number)\s*[:\-]?\s*([A-Z0-9][A-Z0-9.\-]{3,20})/i);
      if (m) v.projectNumber = m[1].trim();
    }
  });

  v.addenda = Array.from(v.addenda).sort((a, b) => a - b);
  v.voltages = Array.from(v.voltages.values()).sort((a, b) => b.count - a.count);
  v.enclosures = Array.from(v.enclosures.values()).sort((a, b) => b.count - a.count);
  v.amps = Array.from(v.amps.values()).sort((a, b) => b.count - a.count).slice(0, 15);
  v.manufacturers = Array.from(v.manufacturers.values()).sort((a, b) => b.count - a.count);
  v.kaicSummary = summarizeKaic(v.kaic);
  return v;
}

function nearestVoltageClass(text, index, radius = 220) {
  // Prefer a voltage token inside the same sentence as the kA value; fall back
  // to the nearest token in a window. A 480 V sentence followed by a 208 V
  // sentence must classify by its own voltage.
  const re = /\b(480|277|208|240|120\/208|208Y|480Y)\b/g;
  const cls = (tok) => (/480|277/.test(tok) ? '480 V' : '208/240 V');
  const sStart = Math.max(0, text.lastIndexOf('. ', index), text.lastIndexOf('; ', index), text.lastIndexOf('\n', index - 1));
  let sEnd = text.length;
  for (const term of ['. ', '; ', '\n']) { const i = text.indexOf(term, index); if (i !== -1 && i < sEnd) sEnd = i; }
  const pick = (from, to) => {
    const seg = text.slice(from, to);
    let best = null; let m;
    re.lastIndex = 0;
    while ((m = re.exec(seg)) !== null) { const dist = Math.abs(from + m.index - index); if (!best || dist < best.dist) best = { dist, cls: cls(m[1]) }; }
    return best ? best.cls : null;
  };
  return pick(sStart, sEnd) || pick(Math.max(0, index - radius), index + radius);
}

function classifyKaContext(ctx, voltageClass) {
  let base = 'general';
  if (/panel|LP-|HP-|PP-|DP-|lighting/i.test(ctx)) base = 'panelboard';
  else if (/switchboard|switchgear|MDP|service/i.test(ctx)) base = 'switchboard';
  else if (/MCC|motor control/i.test(ctx)) base = 'mcc';
  else if (/VFD|drive|SCCR/i.test(ctx)) base = 'vfd';
  else if (/ATS|transfer/i.test(ctx)) base = 'ats';
  // Split by voltage class so a 208 V lighting panel and a 480 V distribution
  // panel are not folded into one conflict.
  return voltageClass ? `${base} ${voltageClass}` : base;
}

function summarizeKaic(list) {
  const byCtx = {};
  for (const k of list) {
    byCtx[k.context] = byCtx[k.context] || { context: k.context, values: {}, evidence: [] };
    byCtx[k.context].values[k.value] = (byCtx[k.context].values[k.value] || 0) + 1;
    if (byCtx[k.context].evidence.length < 6) byCtx[k.context].evidence.push(k);
  }
  return Object.values(byCtx).map((c) => ({ ...c, distinct: Object.keys(c.values).map(Number).sort((a, b) => a - b), conflict: Object.keys(c.values).length > 1 }));
}

/* ------------------------------------------------------------------ */
/* Questions                                                           */
/* ------------------------------------------------------------------ */

/**
 * Build the intake questionnaire. Static questions always appear; dynamic
 * ones appear only when the documents raise them. `defaults` are prefilled
 * from detection so the estimator confirms rather than types.
 */
export function buildQuestions(detection, answers = {}) {
  const { values: v, families, sections } = detection;
  const fam = (k) => families.find((f) => f.key === k);
  const has = (k) => Boolean(fam(k));
  const hasSection = (prefix) => sections.some((s) => s.code.startsWith(prefix));
  const q = [];
  const add = (item) => q.push({ type: 'text', required: false, ...item });

  // --- Bid administration ---------------------------------------------
  const bidGuess = guessBidDue(v);
  add({ id: 'bidDue', group: 'Bid administration', type: 'datetime', required: true,
    text: 'Bid due date and time (local)', default: bidGuess.iso,
    why: bidGuess.text ? `Detected in ${bidGuess.evidence[0].doc} p.${bidGuess.evidence[0].page}; confirm against the latest addendum.` : 'Not found in the documents. Enter it from the advertisement or bid form.',
    evidence: bidGuess.evidence });
  add({ id: 'timezone', group: 'Bid administration', type: 'select', options: ['America/Chicago', 'America/New_York', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu'],
    text: 'Time zone for the bid deadline', default: 'America/Chicago', why: 'Used for reminders and the calendar export.' });
  const qGuess = guessQuestionsDeadline(v, bidGuess.date);
  add({ id: 'questionsDeadline', group: 'Bid administration', type: 'datetime', text: 'Deadline for bidder questions / RFIs to the engineer', default: qGuess.iso,
    why: qGuess.text ? `Detected in ${qGuess.evidence[0].doc} p.${qGuess.evidence[0].page}.` : 'Not found. Many instructions to bidders set questions due 7 to 10 days before the bid.', evidence: qGuess.evidence });
  add({ id: 'addendaCount', group: 'Bid administration', type: 'number', text: 'Highest addendum number issued so far', default: v.addenda.length ? Math.max(...v.addenda) : 0,
    why: v.addenda.length ? `Addenda referenced in the documents: ${v.addenda.join(', ')}.` : 'No addendum references found.' });
  add({ id: 'bidderRole', group: 'Bid administration', type: 'select', options: ['Electrical contractor', 'Electrical distributor / gear quote', 'Systems integrator', 'General contractor', 'Owner / engineer review'],
    text: 'You are preparing this takeoff as', default: 'Electrical contractor', why: 'Changes which bucket is "mine" versus "quoted to me".' });
  add({ id: 'projectType', group: 'Bid administration', type: 'select', options: ['Water / wastewater / pump station', 'Municipal / public building', 'Commercial building', 'Healthcare', 'Education', 'Industrial / manufacturing', 'Site / utility', 'Other'],
    text: 'Project type', default: guessProjectType(detection), why: 'Sets default responsibility conventions (Division 40 integrator versus Division 23 controls contractor).' });
  add({ id: 'drawingsIncluded', group: 'Bid administration', type: 'select', options: ['Yes - electrical sheets and schedules loaded', 'Partial - some sheets or schedule text', 'No - specifications only'],
    text: 'Are the electrical drawings (one-lines, schedules, panel schedules) part of the loaded documents?', default: detection.docs.some((d) => d.role === 'drawings') ? 'Yes - electrical sheets and schedules loaded' : 'No - specifications only',
    why: 'Quantities come from schedules and one-lines. Without them the takeoff is a scope list, not a count.' });
  add({ id: 'funding', group: 'Bid administration', type: 'multiselect', options: ['American Iron and Steel (AIS)', 'Build America, Buy America (BABA)', 'Buy American', 'Davis-Bacon / prevailing wage', 'SRF / federal funding', 'None identified'],
    text: 'Funding and domestic-content requirements that apply', default: [v.ais && 'American Iron and Steel (AIS)', v.baba && 'Build America, Buy America (BABA)', v.buyAmerican && 'Buy American', v.davisBacon && 'Davis-Bacon / prevailing wage', v.srf && 'SRF / federal funding'].filter(Boolean),
    why: 'Detected from the documents. AIS and BABA are different requirements; do not convert one into the other.' });
  add({ id: 'quoteLeadDays', group: 'Bid administration', type: 'number', text: 'Days before bid you want supplier quotes in hand', default: 2, why: 'Sets the "quotes due" reminder.' });
  add({ id: 'rfqLeadDays', group: 'Bid administration', type: 'number', text: 'Days before bid to send quote requests to suppliers', default: 7, why: 'Sets the "send RFQ" reminder. Long-lead gear (MCC, switchgear, generators) needs more.' });

  // --- System basics ----------------------------------------------------
  add({ id: 'systemVoltage', group: 'System basics', type: 'select', options: ['480Y/277 V, 3-phase', '208Y/120 V, 3-phase', '480 V delta / 240 V', '120/240 V, 1-phase', 'Medium voltage service', 'Multiple / other'],
    text: 'Primary service / distribution voltage', default: guessVoltage(v), why: v.voltages.length ? `Voltages seen: ${v.voltages.slice(0, 5).map((x) => x.value + ' (' + x.count + ')').join(', ')}.` : 'No voltage strings detected.' });
  add({ id: 'existingFacility', group: 'System basics', type: 'select', options: ['New construction', 'Addition / modification to existing electrical system', 'Unknown'],
    text: 'New construction or work on an existing electrical system?', default: v.existingMCC || v.existingEquipment ? 'Addition / modification to existing electrical system' : 'New construction',
    why: v.existingMCC ? 'The documents refer to an existing MCC.' : v.existingEquipment ? 'The documents refer to existing equipment.' : 'Existing gear forces manufacturer-compatibility questions.' });
  if (v.hazardous) add({ id: 'hazardous', group: 'System basics', type: 'select', options: ['Yes - classified areas shown', 'No', 'Unknown'], text: 'Are there Class I hazardous (classified) locations affecting equipment enclosures?', default: 'Yes - classified areas shown', why: 'NFPA 820 / Class I Division areas change enclosure and seal-off scope.' });

  // --- Motor control ----------------------------------------------------
  if (has('vfd')) {
    add({ id: 'vfdMounting', group: 'Motor control', type: 'select', options: ['Standalone packaged VFDs (wall or floor)', 'MCC-mounted VFD buckets', 'Furnished with equipment package (pump / HVAC supplier)', 'Mixed / unclear'],
      text: 'How are the VFDs arranged?', default: has('mcc') ? 'Mixed / unclear' : 'Standalone packaged VFDs (wall or floor)', why: 'Drives in MCC buckets are quoted inside the MCC lineup, not as loose units.' });
    add({ id: 'vfdBypass', group: 'Motor control', type: 'select', options: ['No bypass', 'Manual bypass', 'Automatic bypass', 'Not stated'], text: 'Bypass requirement for VFDs', default: v.bypass ? 'Not stated' : 'No bypass', why: v.bypass ? 'The word "bypass" appears near drive text; confirm.' : 'No bypass language found.' });
    add({ id: 'motorLeadLength', group: 'Motor control', type: 'select', options: ['Known and under 100 ft', 'Known and over 100 ft', 'Not stated on documents'], text: 'Maximum VFD-to-motor lead length', default: 'Not stated on documents', why: 'Drives output reactor / dV/dt filter selection. Submersible pump leads are frequently long.' });
    add({ id: 'motorFLA', group: 'Motor control', type: 'select', options: ['Nameplate FLA given on schedules', 'HP only', 'Unknown'], text: 'Is motor nameplate FLA given for drive-fed motors?', default: v.hasFLA ? 'Nameplate FLA given on schedules' : 'HP only', why: 'Drives must be sized from current, not HP.' });
  }
  if (has('mcc')) {
    add({ id: 'mccScope', group: 'Motor control', type: 'select', options: ['New MCC lineup(s)', 'Modify existing MCC (add buckets)', 'Both new and existing', 'MCC mentioned only in boilerplate'], text: 'MCC scope', default: v.existingMCC ? 'Modify existing MCC (add buckets)' : 'New MCC lineup(s)', why: 'Existing MCC work requires manufacturer-matching buckets.' });
    if (v.existingMCC) add({ id: 'mccManufacturer', group: 'Motor control', type: 'text', text: 'Existing MCC manufacturer and model (if known)', why: 'Buckets must match the existing lineup.' });
  }

  // --- Controls responsibility ----------------------------------------
  if (has('controlpanel') || has('instrument') || hasSection('40')) {
    add({ id: 'integratorNamed', group: 'Controls responsibility', type: 'select', options: ['Yes - a Systems Integrator section assigns control panels, PLC/HMI and programming', 'Partially - integrator named but field split unclear', 'No - controls are under Division 26 or unassigned'],
      text: 'Does the specification assign control panels, PLC/HMI and programming to a Systems Integrator?', default: v.integratorNamed ? 'Yes - a Systems Integrator section assigns control panels, PLC/HMI and programming' : 'No - controls are under Division 26 or unassigned',
      why: v.integratorNamed ? `Integrator language found in ${v.integratorClauses.length} clause(s).` : 'No integrator language found.', evidence: v.integratorClauses.slice(0, 4).map((c) => ({ doc: c.doc, page: c.page, snippet: c.text })) });
    add({ id: 'fieldControlWiring', group: 'Controls responsibility', type: 'select', options: ['Systems Integrator', 'Electrical contractor (Division 26)', 'Split: EC installs, integrator terminates', 'Not stated'], text: 'Who installs field control and instrumentation wiring?', default: 'Not stated', why: 'One of the most common scope gaps between integrator and electrical bids.' });
  }
  if (has('instrument')) {
    add({ id: 'instrumentsBy', group: 'Controls responsibility', type: 'select', options: ['Systems Integrator', 'Process equipment supplier', 'Electrical contractor', 'Mixed / per instrument schedule', 'Not stated'], text: 'Who furnishes process instruments (flow, level, pressure, analyzers)?', default: v.integratorNamed ? 'Systems Integrator' : 'Not stated', why: 'Flowmeters in particular are often in the pump or process package.' });
  }
  if (has('bas') || has('hvac')) {
    add({ id: 'hvacControls', group: 'Controls responsibility', type: 'select', options: ['Temperature controls contractor / BAS (Division 23)', 'HVAC equipment packaged controls only', 'Systems Integrator', 'Electrical contractor', 'Not stated'], text: 'Who provides HVAC controls and control wiring?', default: v.tccNamed ? 'Temperature controls contractor / BAS (Division 23)' : 'HVAC equipment packaged controls only', why: v.tccNamed ? 'A temperature controls contractor is named.' : 'No BAS contractor language found.' });
    add({ id: 'hvacDisconnects', group: 'Controls responsibility', type: 'select', options: ['Division 26 furnishes and installs', 'Factory-mounted with equipment', 'Mixed per schedule', 'Not stated'], text: 'Disconnects and starters for HVAC / plumbing equipment are furnished by', default: 'Not stated', why: 'Check the electrical equipment schedule notes (typically "disconnect by Div 26, starter by Div 23").' });
  }
  if (has('ups')) add({ id: 'upsBy', group: 'Controls responsibility', type: 'select', options: ['Inside the control panel - Systems Integrator', 'Loose Division 26 unit - distributor', 'Not stated'], text: 'UPS is furnished by', default: v.integratorNamed ? 'Inside the control panel - Systems Integrator' : 'Not stated', why: 'Section 26 33 53 versus a UPS line inside Division 40.' });

  // --- Supplier channels -----------------------------------------------
  if (has('generator')) add({ id: 'generatorChannel', group: 'Supplier channels', type: 'select', options: ['Electrical distributor / generator rep', 'Generator dealer package directly', 'Owner-furnished'], text: 'Generator is quoted through', default: 'Electrical distributor / generator rep', why: 'Both are common; decide before sending RFQs so it is not double-counted.' });
  if (has('lighting')) add({ id: 'lightingChannel', group: 'Supplier channels', type: 'select', options: ['Electrical distributor (lighting package)', 'Lighting agent / manufacturer rep directly', 'No fixture schedule in documents'], text: 'Lighting package is quoted through', default: 'Electrical distributor (lighting package)', why: 'Fixture schedules drive the lighting quote; note if none is loaded.' });
  if (has('metering')) add({ id: 'meteringBy', group: 'Supplier channels', type: 'select', options: ['Utility furnishes metering equipment', 'Contractor furnishes cabinet/socket, utility furnishes meter', 'Not stated'], text: 'Utility metering equipment is furnished by', default: 'Not stated', why: 'Metering cabinets are a frequent utility-versus-contractor conflict.' });
  if (has('pump')) add({ id: 'pumpControls', group: 'Supplier channels', type: 'select', options: ['Pump supplier furnishes pumps only; VFD/starters by Division 26', 'Pump supplier furnishes complete control package', 'Systems Integrator furnishes pump control panel', 'Not stated'], text: 'Pump controls and drives are furnished by', default: v.integratorNamed ? 'Systems Integrator furnishes pump control panel' : 'Not stated', why: 'Package boundary for the largest motors on the job.' });
  if (has('crane')) add({ id: 'craneControls', group: 'Supplier channels', type: 'select', options: ['Crane supplier furnishes hoist starter and pendant', 'Division 26 furnishes starter', 'Not stated'], text: 'Hoist / crane controls are furnished by', default: 'Crane supplier furnishes hoist starter and pendant', why: 'Division 26 normally carries feeder and disconnect only.' });

  // Enclosure conflict.
  const enc = v.enclosures.map((e) => e.value);
  if (enc.includes('3R') && (enc.includes('4X') || enc.includes('4'))) {
    add({ id: 'outdoorEnclosure', group: 'System basics', type: 'select', options: ['Price Type 4X stainless (specification governs)', 'Price NEMA 3R (drawings govern)', 'Unresolved - qualify'], text: 'Outdoor enclosures: drawings and specification disagree (NEMA 3R and Type 4/4X both appear). Pricing basis?', default: 'Price Type 4X stainless (specification governs)', why: 'Typical order of precedence puts specifications above drawing callouts, but confirm by RFI.' });
  }

  // Apply answers and return.
  return q.map((item) => ({ ...item, value: answers[item.id] !== undefined ? answers[item.id] : item.default }));
}

function guessBidDue(v) {
  for (const b of v.bidDue) {
    if (!b.dates.length) continue;
    const d = parseDateLoose(b.dates[0]);
    if (!d) continue;
    let h = 14, m = 0;
    if (b.times.length) {
      const t = b.times[0].match(/(\d{1,2})(?::(\d{2}))?\s?([ap])/i);
      if (t) { h = Number(t[1]) % 12 + (t[3].toLowerCase() === 'p' ? 12 : 0); m = Number(t[2] || 0); }
    }
    d.setHours(h, m, 0, 0);
    return { date: d, iso: toLocalInput(d), text: b.text, evidence: [{ doc: b.doc, page: b.page, snippet: b.text }] };
  }
  return { date: null, iso: '', text: null, evidence: [] };
}

function guessQuestionsDeadline(v, bidDate) {
  for (const qd of v.questionsDeadline) {
    if (qd.dates.length) {
      const d = parseDateLoose(qd.dates[0]);
      if (d) { d.setHours(17, 0, 0, 0); return { iso: toLocalInput(d), text: qd.text, evidence: [{ doc: qd.doc, page: qd.page, snippet: qd.text }] }; }
    }
    if (qd.daysBefore && bidDate) {
      const d = new Date(bidDate.getTime() - qd.daysBefore * 86400000);
      d.setHours(17, 0, 0, 0);
      return { iso: toLocalInput(d), text: qd.text, evidence: [{ doc: qd.doc, page: qd.page, snippet: qd.text }] };
    }
  }
  return { iso: '', text: null, evidence: [] };
}

function guessVoltage(v) {
  const vals = v.voltages.map((x) => x.value);
  if (vals.some((x) => /12\.47|13\.2|13\.8|4160/.test(x))) return vals.some((x) => /480/.test(x)) ? 'Multiple / other' : 'Medium voltage service';
  if (vals.some((x) => /480/.test(x))) return '480Y/277 V, 3-phase';
  if (vals.some((x) => /208/.test(x))) return '208Y/120 V, 3-phase';
  if (vals.some((x) => /240/.test(x))) return '120/240 V, 1-phase';
  return '480Y/277 V, 3-phase';
}

function guessProjectType(detection) {
  const s = detection.sections;
  const f = detection.families;
  if (s.some((x) => /^4[0346]/.test(x.code)) || f.some((x) => x.key === 'pump' && x.count > 5)) return 'Water / wastewater / pump station';
  if (/dental|clinic|health|hospital|patient/i.test(detection.docs.map((d) => d.name).join(' '))) return 'Healthcare';
  if (f.some((x) => x.key === 'hvac' && x.count > 10) && f.some((x) => x.key === 'lighting')) return 'Commercial building';
  return 'Other';
}

export function toLocalInput(d) {
  if (!d) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ------------------------------------------------------------------ */
/* Takeoff construction                                                */
/* ------------------------------------------------------------------ */

function confidenceFor({ sectionPresent, tagCount, hitCount }) {
  if (sectionPresent && (tagCount > 0 || hitCount >= 5)) return 'Confirmed';
  if (sectionPresent || tagCount > 0 || hitCount >= 5) return 'Probable';
  return 'Possible';
}

/**
 * Build the takeoff from detections and answers.
 * Returns { items, rfis, responsibility, conflicts, compliance }.
 */
export function buildTakeoff(detection, answers = {}) {
  const { values: v, families, sections, tags } = detection;
  const fam = (k) => families.find((f) => f.key === k);
  const sectionFor = (code) => sections.find((s) => s.code.startsWith(code.slice(0, 8)) || s.code.slice(0, 5) === code.slice(0, 5));
  const tagsFor = (key) => tags.filter((t) => t.family === key && !t.isSheet && t.count >= 1);
  const items = [];
  const rfis = [];
  const conflicts = [];
  const compliance = [];
  let rfiN = 0;
  const addRfi = (r) => { rfiN++; const id = `RFI-${pad(rfiN)}`; rfis.push({ id, ...r }); return id; };
  const drawings = answers.drawingsIncluded || '';
  const noDrawings = /^No/.test(drawings);
  const qtyNote = noDrawings ? 'Count from electrical schedules once drawings are loaded' : 'Verify against schedules / one-line';

  const item = (o) => {
    const f = FAMILY_BY_KEY[o.family];
    const sec = sectionFor(o.section || f.section);
    const rec = {
      id: o.id || `${o.family}-${items.length + 1}`,
      family: o.family,
      category: f.category,
      item: o.item || f.label,
      tags: o.tags || [],
      qty: o.qty ?? null,
      qtyBasis: o.qtyBasis || qtyNote,
      unit: o.unit || f.unit,
      bucket: o.bucket || f.bucket,
      channelNote: o.channelNote || f.quoteNote || '',
      electricalScope: o.electricalScope ?? f.electricalScope ?? '',
      section: sec ? sec.code : (o.section || f.section),
      sectionTitle: sec ? sec.title : (SECTION_CATALOG.find((s) => s.code === (o.section || f.section)) || {}).title || '',
      sectionPresent: Boolean(sec),
      confidence: o.confidence || confidenceFor({ sectionPresent: Boolean(sec), tagCount: (o.tags || []).length, hitCount: (fam(o.family) || {}).count || 0 }),
      qualifications: o.qualifications || [],
      rfis: o.rfis || [],
      evidence: o.evidence || ((fam(o.family) || {}).evidence || []).slice(0, 4),
      source: 'rules',
    };
    items.push(rec);
    return rec;
  };

  // ---- kAIC conflicts -----------------------------------------------
  for (const k of v.kaicSummary) {
    if (k.conflict) {
      const id = addRfi({ priority: 'critical', topic: `Interrupting rating conflict (${k.context})`,
        question: `Documents show different fault ratings for ${k.context === 'general' ? 'distribution equipment' : k.context} equipment: ${k.distinct.join(' kA vs ')} kA. Which value governs, and what are the available fault currents from the final study?`,
        pricingBasis: `Price the higher value (${Math.max(...k.distinct)} kA) and state the qualification.`,
        evidence: k.evidence.map((e) => ({ doc: e.doc, page: e.page, snippet: e.snippet })), risk: 'Wrong breaker/bus rating; series-rating or fully-rated cost swing.' });
      conflicts.push({ topic: `${k.context} kAIC`, values: k.distinct.map((x) => x + ' kA'), basis: `${Math.max(...k.distinct)} kA`, rfi: id });
    }
  }

  // ---- Enclosure conflict -----------------------------------------------
  const enc = v.enclosures.map((e) => e.value);
  let enclosureRfi = null;
  if (enc.includes('3R') && (enc.includes('4X') || enc.includes('4'))) {
    enclosureRfi = addRfi({ priority: 'qualify', topic: 'Outdoor enclosure type', question: 'Drawings call NEMA 3R while the specification calls Type 4/4X for outdoor enclosures. Confirm the governing enclosure type for outdoor disconnects, panels and drives.',
      pricingBasis: answers.outdoorEnclosure || 'Price Type 4X stainless (specification governs)', evidence: v.enclosures.filter((e) => ['3R', '4X', '4'].includes(e.value)).flatMap((e) => e.evidence.slice(0, 2)), risk: 'Stainless 4X versus painted 3R can double small-enclosure cost.' });
    conflicts.push({ topic: 'Outdoor enclosure', values: ['NEMA 3R', 'Type 4/4X'], basis: answers.outdoorEnclosure || 'Type 4X', rfi: enclosureRfi });
  }

  // ---- Motor control -----------------------------------------------------
  if (fam('vfd')) {
    const vfdTags = tagsFor('vfd');
    const pumpTags = tagsFor('pump');
    const mounted = answers.vfdMounting || '';
    const quals = [];
    const rf = [];
    if (answers.motorFLA !== 'Nameplate FLA given on schedules') {
      rf.push(addRfi({ priority: 'critical', topic: 'Motor nameplate data for drive sizing', question: 'Provide motor nameplate FLA, service factor, efficiency, speed range and minimum speed for every drive-fed motor. Drives will be sized from current, not horsepower.', pricingBasis: 'Budget frame from HP with explicit statement that final selection follows nameplate current.', evidence: (fam('vfd').evidence || []).slice(0, 2), risk: 'Wrong frame or overload capability; feeder and generator coordination.' }));
      quals.push('Final drive selection subject to motor nameplate current.');
    }
    if (answers.motorLeadLength !== 'Known and under 100 ft') {
      rf.push(addRfi({ priority: 'critical', topic: 'Drive output filtering and motor lead length', question: `Provide maximum VFD-to-motor cable length and confirm output reactor / dV/dt filter requirements.${v.outputReactor ? ' The specification requires an output/load reactor.' : ''}${v.lineReactor ? ' A line reactor is specified.' : ''}`, pricingBasis: `Carry ${v.lineReactor ? 'line reactor and ' : ''}${v.outputReactor ? 'output reactor' : 'no output filter'}; dV/dt filter as add-alternate pending lead length.`, evidence: (fam('vfd').evidence || []).slice(0, 2), risk: 'Missing filters on long submersible leads cause motor insulation failure; unnecessary filters add cost.' }));
      quals.push('Output filtering subject to final motor lead length.');
    }
    if (!v.sccr) quals.push('Drive SCCR to match available fault current; not stated in documents.');
    if (v.harmonics) quals.push('Harmonic mitigation basis (IEEE 519) must be stated by the drive supplier.');
    const bucket = /equipment package/i.test(mounted) ? 'mechanical' : 'distributor';
    const channelNote = /MCC/i.test(mounted) ? 'Quote as VFD buckets inside the MCC lineup; do not double count as loose drives.' : FAMILY_BY_KEY.vfd.quoteNote;
    item({ family: 'vfd', tags: vfdTags.map((t) => t.tag), qty: vfdTags.length || (pumpTags.length || null), qtyBasis: vfdTags.length ? 'Distinct VFD tags' : pumpTags.length ? `Assumed one drive per pump tag (${pumpTags.map((t) => t.tag).join(', ')}); verify against schedule` : qtyNote, bucket, channelNote, qualifications: quals, rfis: rf });
  }
  if (fam('mcc')) {
    const mccTags = tagsFor('mcc');
    const rf = [];
    const quals = [];
    if (/existing/i.test(answers.mccScope || '') || v.existingMCC) {
      rf.push(addRfi({ priority: 'critical', topic: 'Existing MCC manufacturer and bucket compatibility', question: 'Identify the existing MCC manufacturer, model/series, bus rating and available space so new buckets can be matched. Confirm whether used or retrofit-fit buckets are acceptable.', pricingBasis: 'Price manufacturer-matched buckets; qualify lead time.', evidence: (fam('mcc').evidence || []).slice(0, 2), risk: 'Non-matching buckets are rejected at submittal.' }));
      quals.push('Bucket compatibility with existing lineup unresolved.');
    }
    const boilerplate = /boilerplate/i.test(answers.mccScope || '');
    item({ family: 'mcc', tags: mccTags.map((t) => t.tag), qty: boilerplate ? 0 : (mccTags.length || null), qtyBasis: boilerplate ? 'Answered: MCC language is boilerplate only' : mccTags.length ? 'Distinct MCC tags' : qtyNote, qualifications: quals, rfis: rf, confidence: boilerplate ? 'Possible' : undefined });
  }
  if (fam('starter')) item({ family: 'starter', tags: tagsFor('starter').map((t) => t.tag), qty: tagsFor('starter').length || null, qualifications: fam('hvac') ? ['Exclude starters that are integral to mechanical packages.'] : [] });

  // ---- Distribution ------------------------------------------------------
  if (fam('switchboard')) item({ family: 'switchboard', tags: tagsFor('switchboard').map((t) => t.tag), qty: tagsFor('switchboard').length || null, qualifications: v.kaicSummary.some((k) => k.conflict) ? ['kAIC per RFI.'] : [] });
  if (fam('panelboard')) {
    const pt = tagsFor('panelboard');
    item({ family: 'panelboard', tags: pt.map((t) => t.tag), qty: pt.length || null, qtyBasis: pt.length ? 'Distinct panel tags' : qtyNote, qualifications: v.kaicSummary.some((k) => k.conflict && k.context === 'panelboard') ? ['kAIC per RFI.'] : [] });
  }
  if (fam('transformer')) {
    const tt = tagsFor('transformer');
    item({ family: 'transformer', tags: tt.map((t) => t.tag), qty: tt.length || (v.kva.length ? uniq(v.kva.map((k) => k.value)).length : null), qtyBasis: tt.length ? 'Distinct transformer tags' : v.kva.length ? `Distinct kVA ratings seen: ${uniq(v.kva.map((k) => k.value)).join(', ')}` : qtyNote });
  }
  if (fam('ats')) item({ family: 'ats', tags: tagsFor('ats').map((t) => t.tag), qty: tagsFor('ats').length || (fam('generator') ? 1 : null), qtyBasis: tagsFor('ats').length ? 'Distinct ATS tags' : fam('generator') ? 'Assumed one ATS per generator; verify one-line' : qtyNote, qualifications: ['Withstand/close-on rating subject to fault study.'] });
  if (fam('generator')) {
    const ch = answers.generatorChannel || '';
    const rf = [];
    if (!fam('ats')) rf.push(addRfi({ priority: 'qualify', topic: 'Transfer switch scope', question: 'A generator is specified but no transfer switch section or tag was found. Confirm whether an ATS is required and who furnishes it.', pricingBasis: 'Exclude ATS; state exclusion.', evidence: (fam('generator').evidence || []).slice(0, 2), risk: 'Missing a five-figure item.' }));
    item({ family: 'generator', tags: tagsFor('generator').map((t) => t.tag), qty: tagsFor('generator').length || (v.kw.length ? 1 : null), qtyBasis: v.kw.length ? `kW ratings seen: ${uniq(v.kw.map((k) => k.value)).join(', ')}` : qtyNote, bucket: /Owner/i.test(ch) ? 'package' : /dealer/i.test(ch) ? 'package' : 'distributor', channelNote: /dealer/i.test(ch) ? 'Quote directly from generator dealer; exclude from distributor request.' : FAMILY_BY_KEY.generator.quoteNote, rfis: rf, qualifications: ['Load-step and pump HP basis to be reconciled with pump schedule.'] });
  }
  if (fam('spd')) item({ family: 'spd', tags: tagsFor('spd').map((t) => t.tag), qty: tagsFor('spd').length || null, qtyBasis: tagsFor('spd').length ? 'Distinct SPD tags' : 'One per panel/switchboard where shown; verify', qualifications: ['Surge current rating and modes if not stated.'] });
  if (fam('disconnect')) {
    const dt = tagsFor('disconnect');
    item({ family: 'disconnect', tags: dt.map((t) => t.tag), qty: dt.length || null, qtyBasis: dt.length ? 'Distinct disconnect tags' : 'Count from equipment schedule (one per motor/HVAC unit unless factory-mounted)', qualifications: enclosureRfi ? ['Outdoor enclosure type per RFI.'] : [], rfis: enclosureRfi ? [enclosureRfi] : [] });
  }
  if (fam('metering')) {
    const by = answers.meteringBy || 'Not stated';
    const rf = [];
    if (/Not stated/.test(by)) rf.push(addRfi({ priority: 'critical', topic: 'Utility metering furnish responsibility', question: 'Confirm whether the metering cabinet, CT cabinet and meter socket are furnished by the utility or the contractor, and identify the serving utility standard.', pricingBasis: 'Carry as alternate allowance; exclude from base distributor count.', evidence: (fam('metering').evidence || []).slice(0, 2), risk: 'Utility-furnished items priced twice or omitted.' }));
    item({ family: 'metering', tags: tagsFor('metering').map((t) => t.tag), qty: null, bucket: /Utility furnishes/.test(by) ? 'package' : /Contractor furnishes/.test(by) ? 'distributor' : 'ambiguous', rfis: rf });
  }
  if (fam('mv')) item({ family: 'mv', tags: tagsFor('mv').map((t) => t.tag), qty: null, qualifications: ['Long-lead item; confirm utility versus contractor furnish.'], rfis: [addRfi({ priority: 'critical', topic: 'Medium-voltage equipment furnish and lead time', question: 'Confirm which medium-voltage items (pad-mounted transformer, primary metering, MV switch/cable) are contractor-furnished versus utility-furnished, and the required delivery date.', pricingBasis: 'Price contractor-furnished MV items with lead-time qualification.', evidence: (fam('mv').evidence || []).slice(0, 2), risk: 'MV gear lead times exceed most project schedules.' })] });
  if (fam('study')) item({ family: 'study', qty: 1, unit: 'study', qtyBasis: 'Specified', qualifications: ['Confirm study scope (short-circuit, coordination, arc-flash) and who performs it.'] });
  if (fam('solar')) item({ family: 'solar', qty: null });
  if (fam('ev')) item({ family: 'ev', tags: tagsFor('ev').map((t) => t.tag), qty: tagsFor('ev').length || null });
  if (fam('heattrace')) item({ family: 'heattrace', qty: null, bucket: 'ambiguous', rfis: [addRfi({ priority: 'qualify', topic: 'Heat tracing furnish responsibility', question: 'Confirm whether heat tracing cable, controllers and connection kits are furnished under Division 22/23 or Division 26, and provide traced footage.', pricingBasis: 'Exclude heat trace material; carry power connection only.', evidence: (fam('heattrace').evidence || []).slice(0, 2), risk: 'Commonly duplicated between mechanical and electrical bids.' })] });

  // ---- Lighting ----------------------------------------------------------
  if (fam('lighting')) {
    const ch = answers.lightingChannel || '';
    const rf = [];
    if (/No fixture schedule/.test(ch) || noDrawings) rf.push(addRfi({ priority: 'critical', topic: 'Lighting fixture schedule', question: 'Provide the luminaire schedule (types, quantities, basis of design, voltages, emergency provisions) so the lighting package can be quoted.', pricingBasis: 'Lighting package excluded / allowance until schedule received.', evidence: (fam('lighting').evidence || []).slice(0, 2), risk: 'Lighting is frequently the second-largest material line.' }));
    item({ family: 'lighting', qty: 1, unit: 'package', qtyBasis: 'Quote from fixture schedule', bucket: 'distributor', channelNote: /agent/i.test(ch) ? 'Quote from lighting agent directly; tell the distributor to exclude fixtures.' : FAMILY_BY_KEY.lighting.quoteNote, rfis: rf });
  }
  if (fam('lightingcontrols')) item({ family: 'lightingcontrols', qty: 1, unit: 'system', qtyBasis: 'Device counts from lighting plans' });

  // ---- Controls ----------------------------------------------------------
  const integratorAnswer = answers.integratorNamed || (v.integratorNamed ? 'Yes' : 'No');
  const integratorYes = /^Yes/.test(integratorAnswer);
  const integratorPartial = /^Partially/.test(integratorAnswer);
  if (fam('controlpanel')) {
    const ct = tagsFor('controlpanel');
    const rf = [];
    const quals = [];
    let bucket = 'integrator';
    if (!integratorYes && !integratorPartial) {
      bucket = 'ambiguous';
      rf.push(addRfi({ priority: 'critical', topic: 'Control panel / PLC / programming responsibility', question: 'The documents include control panels, PLC/HMI or SCADA equipment but do not clearly assign them to a Systems Integrator. Confirm who furnishes, programs and starts up the control system and who performs field control wiring.', pricingBasis: 'Carry control system as a qualified allowance or exclusion; do not price PLC hardware as loose Division 26 material.', evidence: (fam('controlpanel').evidence || []).slice(0, 3), risk: 'Largest single scope gap on pump station and treatment bids.' }));
    }
    if (integratorPartial || answers.fieldControlWiring === 'Not stated' || !answers.fieldControlWiring) {
      rf.push(addRfi({ priority: 'critical', topic: 'Field control wiring trade split', question: 'Clarify the split for field control and instrumentation wiring between the Systems Integrator and the electrical contractor: who furnishes cable, who installs raceway, who terminates at panels and field devices, and who owns loop checkout.', pricingBasis: 'Carry raceway and 120 V power to panels; qualify control conductor and termination scope.', evidence: v.integratorClauses.slice(0, 3).map((c) => ({ doc: c.doc, page: c.page, snippet: c.text })), risk: 'Unpriced or double-priced control wiring.' }));
      quals.push('Field control wiring split per RFI.');
    }
    item({ family: 'controlpanel', tags: ct.map((t) => t.tag), qty: ct.length || null, qtyBasis: ct.length ? 'Distinct control panel / PLC tags' : qtyNote, bucket, rfis: rf, qualifications: quals });
  }
  if (fam('network')) item({ family: 'network', qty: 1, unit: 'system', bucket: integratorYes || integratorPartial ? 'integrator' : 'ambiguous' });
  if (fam('instrument')) {
    const it = tagsFor('instrument');
    const by = answers.instrumentsBy || 'Not stated';
    const rf = [];
    if (/Not stated|Mixed/.test(by)) rf.push(addRfi({ priority: 'qualify', topic: 'Instrument furnish / install / calibrate split', question: 'For each instrument (flow, level, pressure, analytical), confirm who furnishes, who installs, who provides signal cable and who calibrates. Identify instruments shipped with process equipment packages.', pricingBasis: 'Carry conduit and mounting; exclude instrument purchase unless assigned to Division 26.', evidence: (fam('instrument').evidence || []).slice(0, 3), risk: 'Flowmeters and analyzers are five-figure items.' }));
    item({ family: 'instrument', tags: it.map((t) => t.tag), qty: it.length || null, qtyBasis: it.length ? 'Distinct instrument tags' : 'Count from P&ID / instrument schedule', bucket: /Integrator/.test(by) ? 'integrator' : /Process/.test(by) ? 'mechanical' : /Electrical/.test(by) ? 'distributor' : 'ambiguous', rfis: rf });
  }
  if (fam('ups')) {
    const by = answers.upsBy || 'Not stated';
    item({ family: 'ups', tags: tagsFor('ups').map((t) => t.tag), qty: tagsFor('ups').length || 1, bucket: /Integrator/.test(by) ? 'integrator' : /distributor/.test(by) ? 'distributor' : 'ambiguous', rfis: /Not stated/.test(by) ? [addRfi({ priority: 'qualify', topic: 'UPS furnish responsibility', question: 'Confirm whether the UPS is part of the control panel (Systems Integrator) or a loose Division 26 unit.', pricingBasis: 'Exclude from distributor count; note as integrator item.', evidence: (fam('ups').evidence || []).slice(0, 2), risk: 'Double count.' })] : [] });
  }

  // ---- Mechanical / process packages ------------------------------------
  if (fam('pump')) {
    const pt = tagsFor('pump');
    const pc = answers.pumpControls || 'Not stated';
    const rf = [];
    if (!/complete control package|pumps only/.test(pc)) rf.push(addRfi({ priority: /Not stated/.test(pc) ? 'critical' : 'qualify', topic: 'Pump package boundary', question: 'Confirm the pump supplier package boundary: pumps and motors only, or including VFDs/starters, control panel, moisture/temperature protection relays and level controls. State who mounts and wires the protection relays.', pricingBasis: 'Carry drives/disconnects under Division 26 and protection relays as pump-supplier items; qualify.', evidence: (fam('pump').evidence || []).slice(0, 3), risk: 'Drives priced by both the pump supplier and the electrical bid.' }));
    item({ family: 'pump', tags: pt.map((t) => t.tag), qty: pt.length || null, qtyBasis: pt.length ? 'Distinct pump tags' : qtyNote, bucket: 'mechanical', channelNote: /complete control package/.test(pc) ? 'Pump supplier furnishes controls and drives; Division 26 carries feeders/disconnects only.' : FAMILY_BY_KEY.pump.quoteNote, rfis: rf });
  }
  if (fam('hvac')) {
    const ht = tagsFor('hvac');
    const rf = [];
    const quals = [];
    if (!answers.hvacDisconnects || /Not stated/.test(answers.hvacDisconnects)) {
      rf.push(addRfi({ priority: 'qualify', topic: 'HVAC equipment disconnects and starters', question: 'Confirm for each scheduled HVAC/plumbing unit whether the disconnect, starter or VFD is factory-mounted, furnished by Division 23, or furnished and installed by Division 26. Provide MCA/MOCP for all units.', pricingBasis: 'Carry one Division 26 disconnect per unit not marked factory-mounted; exclude starters/VFDs shown in mechanical schedules as manufacturer-furnished.', evidence: (fam('hvac').evidence || []).slice(0, 3), risk: 'Common double count with the mechanical bid.' }));
      quals.push('Disconnect/starter furnish per equipment schedule notes.');
    }
    item({ family: 'hvac', tags: ht.map((t) => t.tag), qty: ht.length || null, qtyBasis: ht.length ? 'Distinct HVAC equipment tags' : 'Count from mechanical schedule', bucket: 'mechanical', rfis: rf, qualifications: quals });
  }
  if (fam('bas')) item({ family: 'bas', qty: 1, unit: 'system', bucket: /Integrator/.test(answers.hvacControls || '') ? 'integrator' : /Electrical/.test(answers.hvacControls || '') ? 'distributor' : 'mechanical' });
  if (fam('plumbing')) item({ family: 'plumbing', tags: tagsFor('plumbing').map((t) => t.tag), qty: tagsFor('plumbing').length || null });
  if (fam('process')) item({ family: 'process', tags: tagsFor('process').map((t) => t.tag), qty: tagsFor('process').length || null, qualifications: ['Local control panels shipped with packages are not Division 26 equipment; confirm boundary.'] });

  // ---- Other packages -----------------------------------------------------
  if (fam('crane')) item({ family: 'crane', tags: tagsFor('crane').map((t) => t.tag), qty: tagsFor('crane').length || null, bucket: /Division 26 furnishes/.test(answers.craneControls || '') ? 'distributor' : 'package' });
  if (fam('gate')) item({ family: 'gate', qty: null, bucket: 'package', qualifications: ['Confirm an electrical controller/load exists before carrying a circuit.'] });
  if (fam('firealarm')) item({ family: 'firealarm', qty: 1, unit: 'system' });
  if (fam('comms')) item({ family: 'comms', qty: 1, unit: 'system' });
  if (fam('lightning')) item({ family: 'lightning', qty: 1, unit: 'system' });

  // ---- Installation material ------------------------------------------------
  for (const k of ['wire', 'raceway', 'grounding', 'ductbank', 'pads', 'devices']) {
    if (fam(k)) item({ family: k, qty: null, unit: FAMILY_BY_KEY[k].unit, qtyBasis: 'Quantity from drawing takeoff (lengths/counts); not a supplier quote unit', bucket: 'install', confidence: 'Probable' });
  }

  // ---- Drawing availability -------------------------------------------
  if (noDrawings) addRfi({ priority: 'critical', topic: 'Electrical drawings and schedules', question: 'Electrical drawings, one-line diagrams and equipment schedules were not part of the reviewed set. Provide the E-sheets and schedules so quantities and ratings can be confirmed.', pricingBasis: 'Quantities marked TBD until drawings are reviewed.', evidence: [], risk: 'The takeoff is a scope list without counts.' });

  // ---- Compliance items --------------------------------------------------
  if (v.addenda.length) compliance.push({ item: `Acknowledge Addenda ${v.addenda.join(', ')} on the bid form`, why: v.addendumAcknowledge ? 'Bid form requires addendum acknowledgment.' : 'Addenda referenced in the documents.' });
  const funding = answers.funding || [];
  if (funding.includes('American Iron and Steel (AIS)') || v.ais) compliance.push({ item: 'AIS certification and country-of-origin documentation for iron and steel products', why: 'AIS language detected. Applies to iron/steel products permanently incorporated; not the same as BABA.' });
  if (funding.includes('Build America, Buy America (BABA)') || v.baba) compliance.push({ item: 'BABA compliance: iron/steel, manufactured products (55% domestic component cost) and construction materials', why: 'BABA language detected. Electrical gear is a manufactured product; obtain manufacturer certifications or waiver basis.' });
  if (v.srf && !v.baba && !v.ais) compliance.push({ item: 'Confirm whether SRF / federal funding triggers AIS or BABA', why: 'Funding language detected without explicit domestic-content clauses.' });
  if (v.davisBacon) compliance.push({ item: 'Davis-Bacon / prevailing wage rates in labor pricing', why: 'Prevailing wage language detected.' });
  if (v.substitutionDeadline.length) compliance.push({ item: `Substitution / prior-approval requests due ${v.substitutionDeadline[0].days} days before bid`, why: v.substitutionDeadline[0].snippet });
  else if (v.noSubstitution) compliance.push({ item: 'No substitutions permitted - quote named manufacturers only', why: 'Specification prohibits substitutions.' });
  else if (v.orEqual) compliance.push({ item: '"Or equal" language present - confirm prior-approval procedure for alternates', why: 'Alternates may need engineer approval before bid.' });
  if (v.hazardous) compliance.push({ item: 'Classified-area equipment ratings and seal-offs', why: 'Hazardous (classified) location language detected.' });

  // ---- Responsibility matrix --------------------------------------------
  const responsibility = buildResponsibility(items, answers, v, integratorYes || integratorPartial);

  // Order items by bucket then category.
  items.sort((a, b) => (BUCKETS[a.bucket].order - BUCKETS[b.bucket].order) || a.category.localeCompare(b.category) || a.item.localeCompare(b.item));
  const order = { critical: 0, qualify: 1, coordinate: 2, compliance: 3 };
  rfis.sort((a, b) => order[a.priority] - order[b.priority]);
  // Renumber so RFI ids read in priority order, and remap references.
  const remap = {};
  rfis.forEach((r, i) => { const id = `RFI-${pad(i + 1)}`; remap[r.id] = id; r.id = id; });
  for (const i of items) i.rfis = i.rfis.map((x) => remap[x] || x);
  for (const c of conflicts) c.rfi = remap[c.rfi] || c.rfi;
  return { items, rfis, conflicts, compliance, responsibility };
}

function buildResponsibility(items, answers, v, integrator) {
  const rows = [];
  const ec = 'Electrical contractor';
  const si = integrator ? 'Systems Integrator' : 'Unassigned - RFI';
  for (const it of items) {
    if (it.bucket === 'install') continue;
    let r = { item: it.item, tags: it.tags.join(', '), furnishedBy: '', installedBy: ec, powerWiredBy: ec, controlWiredBy: '', programmedBy: 'N/A', startedBy: '', confidence: it.confidence };
    switch (it.family) {
      case 'vfd': r = { ...r, furnishedBy: it.bucket === 'mechanical' ? 'Equipment package supplier' : 'Division 26 / drive supplier', controlWiredBy: integrator ? `${si} with EC coordination` : ec, programmedBy: integrator ? 'Integrator / drive supplier parameters' : 'Drive supplier', startedBy: 'Drive manufacturer representative' }; break;
      case 'mcc': case 'switchboard': case 'panelboard': case 'transformer': case 'spd': case 'disconnect': case 'starter': r = { ...r, furnishedBy: 'Division 26 / distributor', controlWiredBy: 'N/A except monitoring contacts', startedBy: `${ec} testing` }; break;
      case 'ats': r = { ...r, furnishedBy: 'Division 26 / ATS representative', controlWiredBy: `${ec} to generator; ${si} for status points`, programmedBy: 'ATS supplier setup', startedBy: 'Manufacturer authorized representative' }; break;
      case 'generator': r = { ...r, furnishedBy: it.bucket === 'package' ? 'Generator dealer / owner' : 'Division 26 / generator representative', installedBy: `${ec} / generator supplier`, controlWiredBy: `${ec}; ${si} for monitoring`, programmedBy: 'Generator supplier', startedBy: 'Generator authorized representative' }; break;
      case 'controlpanel': case 'network': r = { ...r, furnishedBy: si, installedBy: integrator ? 'Integrator with EC coordination' : ec, controlWiredBy: answers.fieldControlWiring && answers.fieldControlWiring !== 'Not stated' ? answers.fieldControlWiring : `${si} (field split unresolved)`, programmedBy: si, startedBy: si }; break;
      case 'instrument': r = { ...r, furnishedBy: it.bucket === 'integrator' ? si : it.bucket === 'mechanical' ? 'Process equipment supplier' : 'Unresolved - RFI', installedBy: 'Per instrument schedule', controlWiredBy: answers.fieldControlWiring && answers.fieldControlWiring !== 'Not stated' ? answers.fieldControlWiring : 'Unresolved - RFI', programmedBy: si, startedBy: `${si} calibration` }; break;
      case 'ups': r = { ...r, furnishedBy: it.bucket === 'integrator' ? si : it.bucket === 'distributor' ? 'Division 26 / distributor' : 'Unresolved - RFI', startedBy: 'Supplier' }; break;
      case 'pump': r = { ...r, furnishedBy: 'Pump supplier (Division 43)', installedBy: 'Mechanical / process contractor', controlWiredBy: integrator ? si : ec, programmedBy: integrator ? si : 'N/A', startedBy: 'Pump manufacturer representative with integrator' }; break;
      case 'hvac': case 'plumbing': r = { ...r, furnishedBy: 'Mechanical supplier (Division 22/23)', installedBy: 'Mechanical contractor', controlWiredBy: answers.hvacControls && answers.hvacControls !== 'Not stated' ? answers.hvacControls : 'Division 23 / packaged controls - confirm', startedBy: 'Mechanical contractor' }; break;
      case 'bas': r = { ...r, furnishedBy: 'Temperature controls contractor', installedBy: 'Temperature controls contractor', powerWiredBy: `${ec} (120 V to panels)`, controlWiredBy: 'Temperature controls contractor', programmedBy: 'Temperature controls contractor', startedBy: 'Temperature controls contractor' }; break;
      case 'process': r = { ...r, furnishedBy: 'Process equipment supplier', installedBy: 'Process / mechanical contractor', controlWiredBy: integrator ? si : ec, programmedBy: 'Package supplier / integrator', startedBy: 'Package supplier' }; break;
      case 'crane': r = { ...r, furnishedBy: 'Crane supplier (starter, pendant, controls)', installedBy: 'Crane supplier / GC', controlWiredBy: 'Crane supplier (integral)', startedBy: 'Crane supplier' }; break;
      case 'gate': case 'firealarm': case 'comms': case 'lightning': r = { ...r, furnishedBy: 'Specialty subcontractor / package', installedBy: 'Specialty subcontractor', powerWiredBy: `${ec} (power and raceway)`, controlWiredBy: 'Specialty subcontractor', startedBy: 'Specialty subcontractor' }; break;
      case 'metering': r = { ...r, furnishedBy: it.bucket === 'package' ? 'Utility' : it.bucket === 'distributor' ? 'Division 26 / distributor' : 'Unresolved - RFI', controlWiredBy: 'N/A', startedBy: 'Utility' }; break;
      case 'lighting': case 'lightingcontrols': r = { ...r, furnishedBy: 'Division 26 / distributor or lighting agent', controlWiredBy: ec, programmedBy: it.family === 'lightingcontrols' ? 'Controls manufacturer / EC' : 'N/A', startedBy: ec }; break;
      case 'study': r = { ...r, furnishedBy: 'Gear manufacturer / engineer', installedBy: 'N/A', powerWiredBy: 'N/A', controlWiredBy: 'N/A', startedBy: 'N/A' }; break;
      default: r = { ...r, furnishedBy: BUCKETS[it.bucket].label, startedBy: 'Supplier' };
    }
    r.evidence = it.evidence.slice(0, 2);
    rows.push(r);
  }
  // Add clause-based rows from explicit furnish/install language.
  const clauseRows = v.responsibilityClauses.slice(0, 25).map((c) => ({ item: 'Explicit clause', tags: '', furnishedBy: c.text.length > 220 ? c.text.slice(0, 220) + '\u2026' : c.text, installedBy: '', powerWiredBy: '', controlWiredBy: '', programmedBy: '', startedBy: '', confidence: 'Confirmed', evidence: [{ doc: c.doc, page: c.page, snippet: c.text }], clause: true }));
  return { rows, clauses: clauseRows };
}

/* ------------------------------------------------------------------ */
/* Schedule and reminders                                              */
/* ------------------------------------------------------------------ */

/**
 * Build the milestone schedule from answers. Dates are local wall-clock in
 * the browser that runs the app; the ICS export converts to UTC.
 */
export function buildSchedule(answers = {}, opts = {}) {
  const bid = answers.bidDue ? new Date(answers.bidDue) : null;
  if (!bid || Number.isNaN(bid.getTime())) return { bidDue: null, milestones: [] };
  const day = 86400000;
  const rfqLead = Number(answers.rfqLeadDays ?? 7);
  const quoteLead = Number(answers.quoteLeadDays ?? 2);
  const questions = answers.questionsDeadline ? new Date(answers.questionsDeadline) : null;
  const rfiSend = questions && !Number.isNaN(questions.getTime()) ? new Date(questions.getTime() - day) : new Date(bid.getTime() - 7 * day);
  const at = (d, h, m = 0) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x; };
  const ms = [
    { key: 'rfi-send', title: 'Send RFIs to the engineer', when: at(rfiSend, 9), detail: questions ? 'One day before the published question deadline.' : 'No question deadline found; default is seven days before bid.', alarms: ['-P1D', '-PT2H'] },
    { key: 'rfq-out', title: 'Send quote requests to distributor, mechanical supplier and integrator', when: at(new Date(bid.getTime() - rfqLead * day), 9), detail: `${rfqLead} days before bid.`, alarms: ['-P1D', '-PT2H'] },
  ];
  if (questions && !Number.isNaN(questions.getTime())) ms.push({ key: 'questions-deadline', title: 'Engineer question deadline', when: questions, detail: 'Last chance to submit RFIs.', alarms: ['-P1D', '-PT3H'] });
  ms.push({ key: 'rfi-follow', title: 'Follow up on unanswered RFIs; check for new addenda', when: at(new Date(bid.getTime() - 3 * day), 9), detail: 'Three days before bid.', alarms: ['-PT2H'] });
  ms.push({ key: 'quotes-due', title: 'Supplier quotes due back', when: at(new Date(bid.getTime() - quoteLead * day), 12), detail: `${quoteLead} days before bid.`, alarms: ['-P1D', '-PT2H'] });
  ms.push({ key: 'final-check', title: 'Final addendum check and bid-form acknowledgment', when: at(new Date(bid.getTime() - day), 9), detail: 'Confirm every addendum is acknowledged and every critical RFI has a pricing basis.', alarms: ['-PT2H'] });
  ms.push({ key: 'bid-due', title: 'BID DUE', when: bid, detail: 'Bid opening.', alarms: ['-P1D', '-PT4H', '-PT1H'] });
  const now = opts.now ? new Date(opts.now) : new Date();
  for (const m of ms) {
    m.iso = m.when.toISOString();
    m.msUntil = m.when.getTime() - now.getTime();
    m.status = m.msUntil < 0 ? 'past' : m.msUntil < day ? 'today' : m.msUntil < 3 * day ? 'soon' : 'upcoming';
  }
  ms.sort((a, b) => a.when - b.when);
  return { bidDue: bid, milestones: ms };
}

export function buildICS(project, schedule, rfis = []) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Division 26 Takeoff Workbench//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${icsEscape(project.name || 'Bid')} - bid reminders`];
  const stamp = toICSDate(new Date());
  const openRfis = rfis.filter((r) => !r.status || r.status !== 'answered');
  for (const m of schedule.milestones) {
    const uid = `${project.id || 'proj'}-${m.key}@takeoff.restoring-democracy.org`;
    const end = new Date(m.when.getTime() + 30 * 60000);
    let desc = `${m.detail}`;
    if (m.key === 'rfi-send' && openRfis.length) desc += `\n\nOpen RFIs (${openRfis.length}):\n` + openRfis.map((r) => `${r.id} [${RFI_PRIORITY[r.priority] || r.priority}] ${r.topic}`).join('\n');
    lines.push('BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp}`, `DTSTART:${toICSDate(m.when)}`, `DTEND:${toICSDate(end)}`, `SUMMARY:${icsEscape((project.name ? project.name + ' - ' : '') + m.title)}`, `DESCRIPTION:${icsEscape(desc)}`, `CATEGORIES:${icsEscape('Bid,Takeoff')}`);
    for (const a of m.alarms) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(m.title)}`, `TRIGGER:${a}`, 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

/* ------------------------------------------------------------------ */
/* Relevance selection for the Claude pass                             */
/* ------------------------------------------------------------------ */

/**
 * Pick the pages worth sending to a model: anything with a section header of
 * interest, an equipment tag, a family keyword, or bid-administration text.
 * Returns [{doc, page, text, score}] sorted by document then page.
 */
export function selectRelevantPages(docs, opts = {}) {
  const maxChars = opts.maxChars || 1_500_000;
  const famRes = FAMILIES.flatMap((f) => f.patterns);
  const admin = /\b(bid|addend|question|substitut|American Iron|Buy America|prevailing wage|acknowledg)/i;
  const scored = [];
  eachPage(docs, (doc, page) => {
    const t = page.text;
    if (!t || t.trim().length < 40) return;
    let score = 0;
    SECTION_RE.lastIndex = 0;
    for (const h of findAll(SECTION_RE, t)) if (['22', '23', '26', '27', '28', '33', '40', '41', '43', '44', '46'].includes(h.groups[0])) score += 3;
    for (const re of famRes) { re.lastIndex = 0; if (re.test(t)) score += 1; re.lastIndex = 0; }
    TAG_RE.lastIndex = 0;
    score += Math.min(10, findAll(TAG_RE, t).length);
    if (admin.test(t)) score += 2;
    if (doc.role === 'addendum') score += 20;
    if (doc.role === 'drawings') score += 5;
    if (score > 0) scored.push({ doc: doc.name, docId: doc.id, page: page.n, text: t, score });
  });
  scored.sort((a, b) => b.score - a.score);
  const picked = [];
  let total = 0;
  for (const p of scored) { if (total + p.text.length > maxChars) continue; picked.push(p); total += p.text.length; }
  picked.sort((a, b) => a.doc.localeCompare(b.doc) || a.page - b.page);
  return { pages: picked, chars: total, skipped: scored.length - picked.length, totalCandidates: scored.length };
}

/* ------------------------------------------------------------------ */
/* Top-level                                                           */
/* ------------------------------------------------------------------ */

export function analyzeProject(rawDocs, answers = {}, opts = {}) {
  const docs = rawDocs.map(normalizeDocument);
  const sections = detectSections(docs);
  const tags = detectTags(docs);
  const families = detectFamilies(docs);
  const values = detectValues(docs);
  const detection = { docs: docs.map((d) => ({ id: d.id, name: d.name, role: d.role, pages: d.pages.length, chars: d.chars, sha256: d.sha256 })), sections, tags, families, values };
  const questions = buildQuestions(detection, answers);
  const effective = {};
  for (const q of questions) effective[q.id] = q.value;
  const takeoff = buildTakeoff(detection, effective);
  const schedule = buildSchedule(effective, opts);
  const summary = summarize(detection, takeoff, effective);
  return { version: ENGINE_VERSION, detection, questions, answers: effective, takeoff, schedule, summary };
}

function summarize(detection, takeoff, answers) {
  const byBucket = {};
  for (const b of Object.keys(BUCKETS)) byBucket[b] = takeoff.items.filter((i) => i.bucket === b);
  const rfiByPriority = {};
  for (const p of Object.keys(RFI_PRIORITY)) rfiByPriority[p] = takeoff.rfis.filter((r) => r.priority === p).length;
  const div26 = detection.sections.filter((s) => s.division === '26');
  return {
    documents: detection.docs.length,
    pages: detection.docs.reduce((a, d) => a + d.pages, 0),
    sectionsFound: detection.sections.length,
    div26Sections: div26.length,
    familiesFound: detection.families.length,
    tagsFound: detection.tags.filter((t) => !t.isSheet).length,
    items: takeoff.items.length,
    byBucket: Object.fromEntries(Object.entries(byBucket).map(([k, v]) => [k, v.length])),
    distributorUnits: byBucket.distributor.reduce((a, i) => a + (typeof i.qty === 'number' ? i.qty : 0), 0),
    distributorTbd: byBucket.distributor.filter((i) => i.qty === null).length,
    rfis: takeoff.rfis.length,
    rfiByPriority,
    conflicts: takeoff.conflicts.length,
    compliance: takeoff.compliance.length,
    bidDue: answers.bidDue || null,
    integratorNamed: detection.values.integratorNamed,
    funding: answers.funding || [],
  };
}

/* ------------------------------------------------------------------ */
/* Text renderers (Markdown deliverables)                              */
/* ------------------------------------------------------------------ */

function mdEsc(s) {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function fmtQty(i) {
  return i.qty === null || i.qty === undefined ? 'TBD' : String(i.qty);
}

export function renderTakeoffReport(project, result) {
  const { summary, takeoff, answers, detection } = result;
  const L = [];
  L.push(`# ${project.name || 'Project'} - Division 26 Takeoff Report`, '');
  L.push(`**Bid due:** ${answers.bidDue ? new Date(answers.bidDue).toLocaleString() : 'not set'}  `);
  L.push(`**Prepared:** ${new Date().toLocaleString()}  `);
  L.push(`**Documents:** ${detection.docs.map((d) => `${d.name} (${d.pages} pp${d.sha256 ? ', SHA-256 ' + d.sha256.slice(0, 12) + '\u2026' : ''})`).join('; ')}  `);
  L.push(`**Engine:** rules ${result.version}${result.claude ? ' + Claude-assisted review' : ''}`, '');
  L.push('## Bid-ready summary', '', '| Measure | Value |', '|---|---:|');
  L.push(`| Line items | ${summary.items} |`, `| Distributor quote lines | ${summary.byBucket.distributor} (${summary.distributorUnits} counted units, ${summary.distributorTbd} TBD) |`, `| Mechanical supplier lines | ${summary.byBucket.mechanical} |`, `| Systems integrator lines | ${summary.byBucket.integrator} |`, `| Other package lines | ${summary.byBucket.package} |`, `| Installation material lines | ${summary.byBucket.install} |`, `| Ambiguous lines | ${summary.byBucket.ambiguous} |`, `| RFIs critical before pricing | ${summary.rfiByPriority.critical} |`, `| RFIs price with qualification | ${summary.rfiByPriority.qualify} |`, `| Document conflicts preserved | ${summary.conflicts} |`, '');
  for (const b of Object.values(BUCKETS).sort((a, c) => a.order - c.order)) {
    const rows = takeoff.items.filter((i) => i.bucket === b.key);
    if (!rows.length) continue;
    L.push(`## ${b.label}`, '', b.description, '', '| Item | Tags | Qty | Unit | Section | Confidence | Qualifications | RFIs |', '|---|---|---:|---|---|---|---|---|');
    for (const i of rows) L.push(`| ${mdEsc(i.item)} | ${mdEsc(i.tags.join(', '))} | ${fmtQty(i)} | ${i.unit} | ${i.section} | ${i.confidence} | ${mdEsc(i.qualifications.join(' '))} | ${i.rfis.join(', ')} |`);
    L.push('');
  }
  if (takeoff.conflicts.length) {
    L.push('## Document conflicts (preserved, not resolved)', '', '| Topic | Values found | Pricing basis | RFI |', '|---|---|---|---|');
    for (const c of takeoff.conflicts) L.push(`| ${mdEsc(c.topic)} | ${mdEsc(c.values.join(' vs '))} | ${mdEsc(c.basis)} | ${c.rfi} |`);
    L.push('');
  }
  L.push('## Open RFIs and pricing qualifications', '');
  for (const p of Object.keys(RFI_PRIORITY)) {
    const rows = takeoff.rfis.filter((r) => r.priority === p);
    if (!rows.length) continue;
    L.push(`### ${RFI_PRIORITY[p]} - ${rows.length}`, '');
    for (const r of rows) L.push(`${r.id}. **${r.topic}.** ${r.question} *Pricing basis pending answer:* ${r.pricingBasis}`);
    L.push('');
  }
  if (takeoff.compliance.length) {
    L.push('## Bid compliance checklist', '');
    for (const c of takeoff.compliance) L.push(`- [ ] ${c.item} - ${c.why}`);
    L.push('');
  }
  L.push('## Source references', '', '| Section | Title | Hits | Pages |', '|---|---|---:|---|');
  for (const s of detection.sections.filter((x) => ['22', '23', '26', '40', '41', '43', '44', '46', '33'].includes(x.division)).slice(0, 80)) L.push(`| ${s.code} | ${mdEsc(s.title)} | ${s.count} | ${mdEsc(s.pages.slice(0, 6).map((p) => `${p.doc} p.${p.page}`).join('; '))} |`);
  L.push('');
  return L.join('\n');
}

export function renderQuoteRequest(project, result, bucketKey) {
  const b = BUCKETS[bucketKey];
  const { takeoff, answers, detection } = result;
  const rows = takeoff.items.filter((i) => i.bucket === bucketKey);
  const L = [];
  L.push(`# ${project.name || 'Project'} - Quote Request: ${b.label}`, '');
  L.push(`**Bid due:** ${answers.bidDue ? new Date(answers.bidDue).toLocaleString() : 'TBD'}  `);
  L.push(`**Quotes needed by:** ${result.schedule.milestones.find((m) => m.key === 'quotes-due')?.when.toLocaleString() || 'TBD'}  `, '');
  L.push(b.description, '');
  L.push(`Please quote the items below. Identify manufacturer, model, lead time, freight, startup/training, warranty, exceptions and alternates. Where a qualification is listed, state your assumption explicitly.`, '');
  if (!rows.length) L.push('_No items assigned to this channel by the current analysis._', '');
  rows.forEach((i, n) => {
    L.push(`## ${n + 1}. ${i.item}${i.tags.length ? ` (${i.tags.join(', ')})` : ''} - quantity ${fmtQty(i)} ${i.unit}`, '');
    L.push(`- Specification: ${i.section}${i.sectionTitle ? ' ' + i.sectionTitle : ''}${i.sectionPresent ? '' : ' (section not located in documents; verify)'}`);
    if (i.channelNote) L.push(`- Basis: ${i.channelNote}`);
    if (i.electricalScope) L.push(`- Division 26 retains: ${i.electricalScope}`);
    if (i.qtyBasis) L.push(`- Quantity basis: ${i.qtyBasis}`);
    for (const q of i.qualifications) L.push(`- Qualification: ${q}`);
    if (i.rfis.length) L.push(`- Open RFIs: ${i.rfis.join(', ')}`);
    for (const e of i.evidence.slice(0, 2)) L.push(`- Source: ${e.doc} p.${e.page}: "${e.snippet}"`);
    L.push('');
  });
  const v = detection.values;
  L.push('## Project-wide disclosures required with your quotation', '');
  L.push('- Manufacturer and catalog/model number for every item.');
  L.push('- Compliance matrix and exceptions to the referenced specification sections.');
  L.push('- Enclosure, AIC/SCCR/WCR, conductor-entry, lug, accessory and environmental ratings.');
  L.push('- Dimensions, weights, anchor requirements, clearance and heat rejection for floor-mounted equipment.');
  L.push('- Current manufacturing lead time, freight terms, price validity and delivery assumptions.');
  if ((answers.funding || []).includes('American Iron and Steel (AIS)') || v.ais) L.push('- American Iron and Steel compliance and country-of-origin documentation where applicable.');
  if ((answers.funding || []).includes('Build America, Buy America (BABA)') || v.baba) L.push('- Build America, Buy America manufactured-product certification or applicable waiver basis.');
  if (v.manufacturers.length) L.push('', `Manufacturers named in the documents: ${v.manufacturers.map((m) => m.value).join(', ')}.`);
  L.push('');
  return L.join('\n');
}

export function renderRfiLog(project, result, statuses = {}) {
  const { takeoff, answers } = result;
  const L = [];
  L.push(`# ${project.name || 'Project'} - Bidder RFIs`, '');
  L.push(`**Bid due:** ${answers.bidDue ? new Date(answers.bidDue).toLocaleString() : 'TBD'}  `);
  L.push(`**Question deadline:** ${answers.questionsDeadline ? new Date(answers.questionsDeadline).toLocaleString() : 'not stated'}  `, '');
  L.push('| RFI | Priority | Topic | Question | Pricing basis pending answer | Source | Status |', '|---|---|---|---|---|---|---|');
  for (const r of takeoff.rfis) {
    const st = statuses[r.id] || {};
    L.push(`| ${r.id} | ${RFI_PRIORITY[r.priority] || r.priority} | ${mdEsc(r.topic)} | ${mdEsc(r.question)} | ${mdEsc(r.pricingBasis)} | ${mdEsc((r.evidence || []).slice(0, 2).map((e) => `${e.doc} p.${e.page}`).join('; '))} | ${st.answered ? 'Answered ' + st.answered : st.sent ? 'Sent ' + st.sent : 'Open'} |`);
  }
  L.push('', '## Ready-to-send text', '');
  for (const r of takeoff.rfis) L.push(`**${r.id} - ${r.topic}**`, '', r.question, '', `_Bidder's pricing basis if unanswered: ${r.pricingBasis}_`, '');
  return L.join('\n');
}
