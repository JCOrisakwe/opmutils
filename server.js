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

app.get("/freshness", async (req, res) => {
  const url = `${baseUrl}/organizations/${org_id}/data/freshness`;
  const SITES = {
    "3a1bb0d2-4521-4f24-bab9-8426d4827480": "ADEBAYO COMMUNITY MAIN",
    "31454d1f-6cf7-49d2-9567-eb506079ca60": "ADEWALE COMMUNITY",
    "ca0e1988-41c8-4298-a229-1ec1c2f19585": "AJEGUNLE COMMUNITY",
    "a790a744-ee49-4a3f-8995-7843439f4c6f": "MILE 13 CLUSTER",
  };

  const response = await fetch(url, {
    ...options,
    method: "POST",
    body: JSON.stringify({ filters: { sites: Object.keys(SITES) } }),
  });
  const data = await response.json();

  const parsedData = [];
  for (const [site_id, reading] of Object.entries(data.freshness)) {
    parsedData.push({ site: SITES[site_id], "last reading": reading?.reading });
  }

  res.json(parsedData);
});

app.listen(3000, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`),
);
