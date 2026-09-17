const express = require("express");
const app = express();
const PORT = 3000;

const org_id = "64bfd8cd-d361-4368-98c9-c0ea3730559d";
const baseUrl = "https://sparkmeter.cloud/api/v2";
const options = {
  method: "GET",
  headers: {
    "X-API-KEY": "NhjJ3BOBPsrTV_9wEBlrMnDo9VNQT5DcZRyEWRqSgSw",
    "X-API-SECRET": "@Rm7HqY@sg05&1BCfr^m@2nZELD)y@kV",
    "Content-Type": "application/json",
  },
};
const SITES = {};

app.get("/sites", async (req, res) => {
  const url = `${baseUrl}/organizations/${org_id}/sites`;
  const response = await fetch(url, options);
  const data = await response.json();
  for (const site of data.sites) SITES[site.id] = site.name;
  res.json(data.sites);
});

app.listen(3000, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`),
);
