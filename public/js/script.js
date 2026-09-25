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
    warningMsg: modalWarning.textContent,
  },
  "/historical": {
    title: "Historical meter readings",
    sub: "Pick a site and a date range to pull.",
    fields: ["single-site", "daterange"],
  },
  "/reports": {
    title: "Download a report",
    sub: "Set your filters, then run it.",
    fields: ["single-site", "report", "granularity", "daterange"],
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

async function fetchSites() {
  const response = await fetch("/sites");

  // EDIT: added a status check. Previously a failed request (4xx/5xx)
  // would still try to call response.json() on an error payload and
  // proceed to build <option> elements out of garbage data.
  if (!response.ok) {
    console.error("Failed to load sites:", response.status);
    return;
  }

  const data = await response.json();

  const fragment = document.createDocumentFragment();
  for (const site of data) {
    const option = document.createElement("option");
    option.value = site.id;
    option.textContent = site.name.toLowerCase();
    fragment.append(option);
  }

  const siteSelect = document.querySelector("#siteSelect");
  siteSelect.append(fragment.cloneNode(true));
  siteSelect.querySelector("option").textContent = "Select a site…";

  document.querySelector("#siteSelects").replaceChildren(fragment);

  downloadBtn.classList.add("active");
  downloadBtn.disabled = false;
}

function openModal(href) {
  const cfg = CONFIG[href];
  title.textContent = cfg.title;
  sub.textContent = cfg.sub;

  allFields.forEach((field) => {
    const isRequiredField = cfg.fields.includes(field.dataset.field);
    field.classList.toggle("active", isRequiredField);
  });

  form.action = href;
  form.dataset.action = href;

  if (href === "/live") modalWarning.textContent = cfg.warningMsg;
  modalWarning.classList.toggle("active", href === "/live");

  overlay.classList.add("open");
}

function closeModal() {
  overlay.classList.remove("open");
}

fetchSites();

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

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const requiredControls = controlsByRoute[form.dataset.action];

  const formFilled = Object.values(requiredControls).every((control) => {
    return control.type === "radio"
      ? form.querySelector(`input[name=${control.name}]:checked`)
      : control.value;
  });

  let validDateRange = true;
  if (requiredControls["dateFrom"]) {
    const dateFrom = requiredControls["dateFrom"].value;
    const dateTo = requiredControls["dateTo"].value;

    validDateRange = dateFrom && dateTo && dateFrom <= dateTo;
  }

  const warningMsg = "";
  if (!formFilled) {
    modalWarning.textContent = "Please complete all fields before submitting.";
  } else {
    form.submit();
    closeModal();
  }
  modalWarning.classList.add("active");
});
