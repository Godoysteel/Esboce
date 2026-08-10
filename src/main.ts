import { Bootstrap } from "./app/Bootstrap.js";
import { initializeMonitoring } from "./core/Monitoring.js";

initializeMonitoring();
Bootstrap.start();
