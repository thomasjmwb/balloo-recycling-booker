/**
 * CSS selectors for form elements.
 * Organized by form step.
 */

export const selectors = {
  // Form-wide
  form: {
    formGuid: "#form-guid",
    requestVerificationToken: 'input[name="__RequestVerificationToken"]',
    currentSectionId: "#current-section-id",
    submitButton: "#submit-button",
    backButton: "#back-button",
    startAgainButton: "#start-again-button",
  },

  // Section navigation (sidebar)
  sections: {
    current: ".ss_sectionCurrent",
    future: ".ss_sectionFuture",
  },

  // Step 1: Your details
  step1: {
    heading: "#dv20",
    email: "#FF6",
    blueBadgeHolder: "#FF63",
    residentialOrCharity: "#FF23",
    whoBringsWaste: "#FF70",
    charityName: "#FF80",
    charityNumber: "#FF58",
    // Address lookup
    postcodeInput: "#FF17-text",
    postcodeSearchBtn: "#FF17-find",
    addressList: "#FF17-list",
    addressHidden: "#FF17",
    addressDisplay: "#FF17-displayname",
    addressChangeBtn: "#FF17-change",
    // Commercial provider fields
    commercialProviderName: "#FF73",
    wasteCarriersLicence: "#FF59",
    licenceExpiry: "#FF71",
    transferNoteNumber: "#FF60",
    // Van hire
    hiringVanYes: "#FF18",
    hiringVanNo: "#FF18_No",
  },

  // Step 2: Your waste (checkboxes)
  step2: {
    heading: "#dv21",
    // All waste type checkboxes by field ID
    bicycles: "#FF135",
    blueBinRecyclable: "#FF34",
    carBatteries: "#FF48",
    cardboard: "#FF33",
    cookingOil: "#FF50",
    electrical: "#FF32",
    fluorescentTubes: "#FF47",
    furniture: "#FF26",
    furnitureReuse: "#FF27",
    gardenWaste: "#FF35",
    glassBottles: "#FF37",
    hardPlastics: "#FF30",
    printerCartridges: "#FF52",
    metals: "#FF29",
    mobilePhones: "#FF53",
    nonRecyclable: "#FF39",
    oilFilters: "#FF134",
    oilyRags: "#FF133",
    paint: "#FF36",
    plasterboard: "#FF40",
    portableBatteries: "#FF46",
    rubble: "#FF31",
    textiles: "#FF38",
    timber: "#FF28",
    tvsMonitors: "#FF45",
    usedEngineOil: "#FF49",
    vapes: "#FF117",
  },

  // Step 3: Your vehicle
  step3: {
    heading: "#dv61",
    vehicleRegistration: "#FF7",
    transportType: "#FF19",
    trailerType: "#FF77",
    site: "#FF22",
  },

  // Step 4: Terms and conditions
  step4: {
    termsCheckbox: "#FF3",
  },

  // Step 5: Your booking (date/time)
  step5: {
    heading: "#dv25",
    dateSelect: "#FF8_Date",
    timeSelect: "#FF8_Time",
  },
} as const;

/**
 * Waste type field IDs with labels.
 */
export const wasteTypes = [
  { id: "FF135", label: "Bicycles" },
  { id: "FF34", label: "Blue bin mixed dry recyclable waste items", defaultChecked: true },
  { id: "FF48", label: "Car batteries", defaultChecked: true },
  { id: "FF33", label: "Cardboard", defaultChecked: true },
  { id: "FF50", label: "Cooking oil", defaultChecked: true },
  { id: "FF32", label: "Electrical and electronic appliances" },
  { id: "FF47", label: "Fluorescent tubes" },
  { id: "FF26", label: "Furniture" },
  { id: "FF27", label: "Furniture (better quality) - Reuse drop off" },
  { id: "FF35", label: "Garden waste (compostable/organic)" },
  { id: "FF37", label: "Glass bottles and jars" },
  { id: "FF30", label: "Hard Plastics" },
  { id: "FF52", label: "Household printer cartridges" },
  { id: "FF29", label: "Metals" },
  { id: "FF53", label: "Mobile phones" },
  { id: "FF39", label: "Non-recyclable waste" },
  { id: "FF134", label: "Oil filters" },
  { id: "FF133", label: "Oily rags" },
  { id: "FF36", label: "Paint" },
  { id: "FF40", label: "Plasterboard" },
  { id: "FF46", label: "Portable batteries" },
  { id: "FF31", label: "Rubble/Hardcore/Tiles/Ceramics/Soil" },
  { id: "FF38", label: "Textiles" },
  { id: "FF28", label: "Timber" },
  { id: "FF45", label: "TVs & Monitors" },
  { id: "FF49", label: "Used engine oil" },
  { id: "FF117", label: "Vapes" },
] as const;

/**
 * Transport type options.
 */
export const transportTypes = [
  "Car",
  "People carrier (MPV)",
  "4x4",
  "4-door pick-up",
  "Campervan",
  "Small van adapted for passenger transport",
  "Panel van",
  "Crew cab van",
  "Minibus",
  "Luton van",
  "2-door pick-up",
  "Vehicle bearing business logo",
] as const;

/**
 * Trailer type options.
 */
export const trailerTypes = ["No Trailer", "Single Axle Trailer", "Double Axle Trailer"] as const;

/**
 * Site options.
 */
export const sites = [
  "Balloo",
  "Ballygowan",
  "Comber",
  "Donaghadee",
  "Holywood",
  "Kircubbin",
  "Millisle",
  "Newtownards",
  "Portaferry",
] as const;
