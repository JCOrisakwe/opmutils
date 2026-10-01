const schedule = document.querySelector(".schedule");
const overlay = document.querySelector("#circuitModal");
const closeBtn = document.querySelector("#modalClose");
const downloadBtn = document.querySelector("#modalSubmit");
const cancelBtn = document.querySelector("#modalCancel");
const form = document.querySelector("#modalForm");
const title = document.querySelector("#modalTitle");
const modalWarning = document.querySelector(".modal-warning");
const sub = document.querySelector("#modalSub");
const allFields = form.querySelectorAll("[data-field]");

const CONFIG = {
  "/freshness": {
    title: "Data freshness",
    sub: "Check when a site last reported in.",
    fields: ["multi-site"],
  },
  "/live": {
    title: "Live meter readings",
    sub: "Pull activity from the last 15-60 minutes.",
    fields: ["multi-site", "age"],
    warningMsg:
      "Nova sites must have a configured service area to get live readings.",
  },
  "/historical": {
    title: "Historical meter readings",
    sub: "Pick a site and a date range to pull.",
    fields: ["single-site", "date"],
    warningMsg: "This download may take a while",
  },
  "/reports": {
    title: "Download a report",
    sub: "Set your filters, then run it.",
    fields: ["single-site", "report", "granularity", "daterange"],
    warningMsg: "This download may take a while",
  },
};

const controlsByRoute = {};
for (const [route, routeConfig] of Object.entries(CONFIG)) {
  const selector = routeConfig.fields
    .map((field) => `[data-field=${field}] input, [data-field=${field}] select`)
    .join(", ");

  controlsByRoute[route] = {};
  const controlElems = form.querySelectorAll(selector);
  for (const controlEl of controlElems)
    controlsByRoute[route][controlEl.name] = controlEl;
}

let sitesError = "";
async function fetchSites() {
  const singleSiteSelect = document.querySelector("#siteSelect");
  const multiSiteSelect = document.querySelector("#siteSelects");

  try {
    const response = await fetch("/sites");
    if (!response.ok) throw new Error();

    const data = await response.json();

    const fragment = document.createDocumentFragment();
    for (const site of data) {
      const option = document.createElement("option");
      option.value = site.id;
      option.textContent = site.name.toLowerCase();
      fragment.append(option);
    }

    multiSiteSelect.replaceChildren(fragment.cloneNode(true));
    [...multiSiteSelect.options].forEach((option) => (option.selected = true));
    singleSiteSelect.append(fragment);
    singleSiteSelect.querySelector("option").textContent = "Select a site…";

    downloadBtn.classList.add("active");
    downloadBtn.disabled = false;
  } catch (err) {
    sitesError = "Couldn't load sites. Check your connection and refresh.";
    modalWarning.textContent = sitesError;
    singleSiteSelect.options[0].textContent = "Couldn't load sites :(";
    multiSiteSelect.options[0].textContent = "Couldn't load sites :(";
  }
}

function openModal(href) {
  const cfg = CONFIG[href];
  if (!cfg) return;

  title.textContent = cfg.title;
  sub.textContent = cfg.sub;
  modalWarning.textContent = sitesError || cfg.warningMsg;

  allFields.forEach((field) => {
    const isRequiredField = cfg.fields.includes(field.dataset.field);
    field.classList.toggle("active", isRequiredField);

    field
      .querySelectorAll("input, select")
      .forEach((c) => (c.disabled = !isRequiredField));
  });

  form.action = href;
  form.dataset.action = href;

  overlay.classList.add("open");
}

function closeModal() {
  overlay.classList.remove("open");
}

fetchSites();

const isFormFilled = (requiredControls) => {
  const isValid = Object.values(requiredControls).every((control) =>
    control.type === "radio"
      ? form.querySelector(`input[name=${control.name}]:checked`)
      : control.value,
  );

  return {
    isValid,
    errorMsg: "Please complete all fields before submitting.",
  };
};

const isDateRangeValid = (requiredControls, max_range_days = 30) => {
  if (!requiredControls["dateFrom"]) return { isValid: true };

  const dateFrom = requiredControls["dateFrom"].value;
  const dateTo = requiredControls["dateTo"].value;

  const dateValid = isDateValid(requiredControls, dateTo);
  if (!dateValid.isValid) return dateValid;

  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const diffDays = (Date.parse(dateTo) - Date.parse(dateFrom)) / MS_PER_DAY + 1;

  return {
    isValid: dateFrom <= dateTo && diffDays <= max_range_days,
    errorMsg: `Please select a valid date range (maximum ${max_range_days} days).`,
  };
};

const isDateValid = (requiredControls, dateStr) => {
  if (!dateStr && !requiredControls["date"]) return { isValid: true };

  const dateToday = new Date().toLocaleDateString("en-CA");
  const dateToCheck = dateStr || requiredControls["date"].value;
  return {
    isValid: dateToCheck <= dateToday,
    errorMsg: "Date Cannot be in the future.",
  };
};

async function submitForm() {
  const params = new URLSearchParams(new FormData(form));
  const url = `${form.dataset.action}?${params}`;

  downloadBtn.disabled = true;
  downloadBtn.classList.remove("active");
  downloadBtn.textContent = "Downloading…";

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Server responded ${response.status}`);
    }

    const blob = await response.blob();

    const disposition = response.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^";]+)"?/);
    const filename = match ? match[1] : "download.xlsx";

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);

    closeModal();
  } catch (err) {
    console.error("Download failed:", err);
    modalWarning.textContent =
      err instanceof TypeError
        ? "Check your connection and try again."
        : err.message || "Download failed. Please try again.";
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.textContent = "Download";
    downloadBtn.classList.add("active");
  }
}

schedule.addEventListener("click", (e) => {
  const circuit = e.target.closest(".circuit");
  if (!circuit) return;

  e.preventDefault();
  openModal(circuit.getAttribute("href"));
});

closeBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);

overlay.addEventListener("click", (e) => {
  if (e.target === overlay) closeModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && overlay.classList.contains("open")) closeModal();
});

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const requiredControls = controlsByRoute[form.dataset.action];

  const checks = [
    () => isFormFilled(requiredControls),
    () => isDateRangeValid(requiredControls),
    () => isDateValid(requiredControls),
  ];

  for (const check of checks) {
    const result = check();
    if (!result.isValid) {
      return (modalWarning.textContent = result.errorMsg);
    }
  }

  submitForm();
});
