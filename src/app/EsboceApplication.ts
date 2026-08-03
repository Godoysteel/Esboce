import { Core } from "../core/Core.js";
import { Store, commands } from "../core/Store.js";

export class EsboceApplication {

    public start(): void {

        console.log("==================================");
        console.log("      ESBOCE INITIALIZED");
        console.log("==================================");

        // Prova de integração: Core + Store já migrados e funcionando
        // dentro do app real. Próximo módulo a entrar aqui é
        // Scene3DRenderer.
        const project = Store.getProject();
        console.log(`Core+Store carregados — projeto com ${project.floors.length} pavimento(s), GRID=${Core.GRID}`);

        Store.onChange((event) => console.log('[Store]', event.type));
        commands.createWall(0, 0, 200, 0);

    }

}