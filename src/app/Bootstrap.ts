import { EsboceApplication } from "./EsboceApplication.js";

export class Bootstrap {
    public static start(): void {
        const app = new EsboceApplication();
        app.start();
    }
}