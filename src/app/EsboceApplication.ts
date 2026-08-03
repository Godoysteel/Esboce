import { Core } from "../core/Core.js";

export class EsboceApplication {

    public start(): void {

        console.log("==================================");
        console.log("      ESBOCE INITIALIZED");
        console.log("==================================");

        // Prova de integração: Core já está migrado e funcionando dentro
        // do app real (não só isolado em teste). Próximo módulo a entrar
        // aqui é Catalog, depois Store.
        const project = Core.createProject();
        console.log(`Core carregado — projeto inicial com ${project.floors.length} pavimento(s), GRID=${Core.GRID}`);

    }

}