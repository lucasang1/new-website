import { initConnectMenu } from "./navigation.js";

const params = new URLSearchParams(window.location.search);
const itemId = params.get("id");
const title = itemId
  ? itemId.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
  : "Coming soon";

document.title = `${title} — Lucas Ang`;
document.querySelector("[data-landing-title]").textContent = title;
initConnectMenu();
