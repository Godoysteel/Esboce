import * as THREE from "three";
import { Core } from "../core/Core.js";
import { Store, commands } from "../core/Store.js";
import { Scene3DRenderer } from "../core/Scene3DRenderer.js";

export class EsboceApplication {

    public start(): void {

        console.log("==================================");
        console.log("      ESBOCE INITIALIZED");
        console.log("==================================");

        // Prova de integração: Core + Store + Scene3DRenderer já migrados
        // e funcionando dentro do app real. Próximo módulo a entrar aqui
        // é ViewportController.
        const project = Store.getProject();
        console.log(`Core+Store carregados — projeto com ${project.floors.length} pavimento(s), GRID=${Core.GRID}`);

        Store.onChange((event) => console.log('[Store]', event.type));
        commands.createWall(0, 0, 200, 0);
        commands.createWall(200, 0, 200, 200);
        commands.createWall(200, 200, 0, 200);
        commands.createWall(0, 200, 0, 0);

        const scene = new THREE.Scene();
        Scene3DRenderer.rebuild(scene, project, { width: 800, height: 600 }, { editingFloorIndex: 0 });
        let meshCount = 0;
        scene.traverse((obj) => { if (obj.type === 'Mesh') meshCount++; });
        console.log(`Scene3DRenderer carregado — ${scene.children.length} objetos na cena (${meshCount} malhas)`);

    }

}