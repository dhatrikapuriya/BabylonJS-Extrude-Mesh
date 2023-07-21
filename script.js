// JavaScript: The code to create a 3D mesh expandable cube

// Constants
const MOVE_SPEED = 5;
const BOX_COLOR = new BABYLON.Color4(1, 1, 1, 1);
const BOX_TRANSPARENT_COLOR = new BABYLON.Color4(1, 1, 1, 0.4);
const HOVER_COLOR = new BABYLON.Color4(12 / 255, 242 / 255, 93 / 255, 1);
const GHOST_COLOR = new BABYLON.Color4(2 / 255, 114 / 255, 95 / 255, 1);

// Variables
let dragging = false;
let hitInfo = null;
let scene = null;

// Get the canvas element
const canvas = document.getElementById("sceneCanvas");

// Create the Babylon.js engine
const engine = new BABYLON.Engine(canvas, true);

// Function to create the 3D scene
const createScene = () => {
    // Create a new scene
    scene = new BABYLON.Scene(engine);

    // Set the background color of the scene
    scene.clearColor = new BABYLON.Color4(207 / 255, 212 / 255, 217 / 255, 1);


    // Enable order-independent transparency for the scene
    scene.useOrderIndependentTransparency = true;

    // Create a box mesh
    let box = BABYLON.MeshBuilder.CreateBox("box", { size: 1, updatable: true }, scene);
    box.hasVertexAlpha = true;
    box.convertToFlatShadedMesh();
    box.position = new BABYLON.Vector3(0, 0, 0);

    // Get the positions and colors data of the box mesh
    let positions = box.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    let colors = box.getVerticesData(BABYLON.VertexBuffer.ColorKind);

    // Initialize colors array if not already available
    if (!colors)
        colors = Array.from({ length: (positions.length / 3) * 4 }, () => 1);

    // Get the indices of the box mesh
    const indices = box.getIndices();
    const shared = findSharedVertices(indices, positions);

    // Create a camera and position it
    const camera = new BABYLON.ArcRotateCamera(
        "camera",
        0,
        0,
        10,
        box.position,
        scene
    );
    camera.setPosition(new BABYLON.Vector3(0, 0, 5));
    camera.attachControl(canvas, true);

    // Create a hemispheric light
    new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 10, 0), scene);

    // Handle window resize
    window.addEventListener("resize", function () {
        engine.resize();
    });

    // Render loop
    engine.runRenderLoop(() => {
        scene.render();
    });

    // Function to clear the color of the box
    const clearBoxColor = (color) => {
        colors = Array.from({ length: positions.length / 3 }, () =>
            color.asArray()
        ).flat();
        box.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors);
    };

    // Function to highlight a face of the box with a given color
    const highlightFace = (face, color) => {
        const facet = 2 * Math.floor(face);

        for (let i = 0; i < 6; i++) {
            const vertex = indices[3 * facet + i];

            colors[4 * vertex] = color.r;
            colors[4 * vertex + 1] = color.g;
            colors[4 * vertex + 2] = color.b;
            colors[4 * vertex + 3] = color.a;
        }

        box.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors);
    };

    // Variable to keep track of clicks
    let counter = 0;

    // Pointer down event handler
    scene.onPointerDown = () => {
        // Pick an object from the scene at the pointer position
        const hit = scene.pick(scene.pointerX, scene.pointerY);

        // Handle the first click
        if (counter === 0 && hit.pickedMesh) {
            counter++;
            if (hit.pickedMesh) {
                // Set dragging to true to indicate that the object is being dragged
                dragging = true;

                // Get the face ID of the hit
                const face = hit.faceId / 2;
                const facet = 2 * Math.floor(face);

                // Get the normal of the face
                const normal = hit.getNormal();

                // Save the hit information
                hitInfo = ({
                    face,
                    facet,
                    normal,
                    position: {
                        x: scene.pointerX,
                        y: scene.pointerY,
                    },
                });

                // Clear the color of the box and highlight the face with ghost color
                clearBoxColor(BOX_TRANSPARENT_COLOR);
                highlightFace(face, GHOST_COLOR);

                // Create a temporary plane for dragging
                plane = BABYLON.MeshBuilder.CreatePlane("temp", {}, scene);
                plane.setIndices([0, 1, 2, 3, 4, 5]);
                plane.setVerticesData(
                    BABYLON.VertexBuffer.PositionKind,
                    indices
                        .slice(3 * facet, 3 * facet + 6)
                        .map((i) => [...positions.slice(3 * i, 3 * i + 3)])
                        .flat()
                );
                plane.setVerticesData(
                    BABYLON.VertexBuffer.ColorKind,
                    Array.from({ length: 6 }).fill(HOVER_COLOR.asArray()).flat()
                );
                plane.updateFacetData();
                plane.convertToFlatShadedMesh();
            }
        } else if (counter === 1) {
            // Dispose the temporary plane and reset counter and dragging variables
            plane.dispose();
            counter = 0;
            camera.attachControl(canvas, true);
            dragging = false;
            hitInfo = null;
        }
    };

    // Function to unproject a point from screen space to world space
    const unproject = ({ x, y }) =>
        BABYLON.Vector3.Unproject(
            new BABYLON.Vector3(x, y, 0),
            engine.getRenderWidth(),
            engine.getRenderHeight(),
            BABYLON.Matrix.Identity(),
            scene.getViewMatrix(),
            scene.getProjectionMatrix()
        );

    // Pointer move event handler
    scene.onPointerMove = () => {
        if (dragging && hitInfo) {
            // Detach camera control
            camera.detachControl();

            // Get the facet, normal, and position from hitInfo
            const { facet, normal, position } = hitInfo;

            // Calculate the offset from the initial pointer position
            const offset = unproject({
                x: scene.pointerX,
                y: scene.pointerY,
            }).subtract(unproject(position));

            // Get the vertices of the face and shared vertices
            const vertices = Array.from(
                new Set(
                    indices.slice(3 * facet, 3 * facet + 6).reduce((acc, cur) => {
                        acc.push(cur);
                        acc.push(...shared[cur]);
                        return acc;
                    }, [])
                )
            );

            // Move the vertices according to the offset and normal
            vertices.forEach((vertex) => {
                for (let j = 0; j < 3; j++) {
                    positions[3 * vertex + j] +=
                        MOVE_SPEED *
                        BABYLON.Vector3.Dot(offset, normal) *
                        normal.asArray()[j];
                }
            });

            // Update the position of the box mesh
            box.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions, true);

            // Update the hitInfo position with the current pointer position
            hitInfo = ({
                ...hitInfo,
                position: {
                    x: scene.pointerX,
                    y: scene.pointerY,
                },
            });
        } else {
            // If not dragging, clear the box color and highlight the hovered face
            clearBoxColor(BOX_COLOR);

            const hit = scene.pick(scene.pointerX, scene.pointerY);

            if (hit.pickedMesh) {
                const face = hit.faceId / 2;
                highlightFace(face, HOVER_COLOR);
            }
        }
    };

    // Create the GUI for the scene
    const Ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);
    const Reset = BABYLON.GUI.Button.CreateSimpleButton("Reset", "Reset");
    Reset.widthInPixels = 150;
    Reset.heightInPixels = 70;
    Reset.cornerRadius = 20;
    Reset.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    Reset.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    Reset.background = "#ffffff30";
    Reset.color = "#ffffff";
    Reset.paddingRight = "20px";
    Reset.paddingTop = "20px";
    Reset.paddingBottom = "20px";
    Reset.hoverCursor = "pointer";

    //GUI for Text in Reset Button
    const ResetText = new BABYLON.GUI.TextBlock();
    ResetText.text = "Reset";
    ResetText.color = "#000000"; // Black font color
    ResetText.fontSize = 20;
    ResetText.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    ResetText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    Reset.addControl(ResetText); 

    // Handle the Reset button click event
    Reset.onPointerClickObservable.add(function () {
        // Dispose the current box mesh
        box.dispose();
        // Create a new box mesh and reset its properties
        box = new BABYLON.MeshBuilder.CreateBox(
            "box",
            { size: 1, updatable: true },
            scene
        );
        box.convertToFlatShadedMesh();
        box.position = new BABYLON.Vector3(0, 0, 0);
        // Update the positions variable with the new box's positions
        positions = box.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        console.log("Positions Reset DONE");
    });

    // Add the Reset button to the GUI
    Ui.addControl(Reset);
};

// Function to find shared vertices based on indices and positions
function findSharedVertices(indices, positions) {
    const shared = Array.from({ length: indices.length }, () => []);

    for (let i = 0; i < indices.length; i++) {
        for (let j = 0; j < indices.length; j++) {
            if (
                positions[3 * indices[i] + 0] === positions[3 * indices[j] + 0] &&
                positions[3 * indices[i] + 1] === positions[3 * indices[j] + 1] &&
                positions[3 * indices[i] + 2] === positions[3 * indices[j] + 2]
            ) {
                shared[indices[i]].push(indices[j]);
            }
        }
    }

    return shared;
}

// Call the createScene function to initialize the 3D scene
createScene();
