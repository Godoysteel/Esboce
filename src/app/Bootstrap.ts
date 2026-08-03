import { EsboceApplication } from "./EsboceApplication";

export class Bootstrap {
    public static start(): void {
        const app = new EsboceApplication();
        app.start();
    }
}