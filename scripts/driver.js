
MySample.main = (function () {
    'use strict';

    let canvas = document.getElementById('canvas-main');
    let gl = canvas.getContext('webgl');


    let environment = {}
    let model = {};
    let model2 = {};
    let lightSource = {};
    let lightSource2 = {};
    let lightSource3 = {};
    let buffers = {};
    let shaders = {};
    let previousTime = performance.now();
    let counter1 = 0;

    //------------------------------------------------------------------
    //
    // Helper function used to set the rotation state and parameters for
    // the model.
    //
    //------------------------------------------------------------------
    function initializeModelRotation(model) {
        //
        // Current rotation status
        model.rotation = {  // Radians
            x: Math.PI / 4,
            y: 0,
            z: 0
        };
        //
        // Rotation update rate
        model.rotationRate = {   // Radians per second (divide by 1000 to go from ms to seconds)
            x: 0,
            y: (Math.PI / 4) / 1000,
            z: 0
        };
    }

    //------------------------------------------------------------------
    //
    // Prepare the rendering environment.
    //
    //------------------------------------------------------------------
    function initializeData() {
        lightSource.vecAmbient = new Uint8Array([0.0, 0.0, 0.0, 1.0]);

        lightSource.vecDiffuse = new Uint8Array([1.0, 0.0, 0.0, 1.0]);
        lightSource.vecPosition = new Uint8Array([0.0, 0.0, 2.0, 1.0]);

        lightSource2.vecDiffuse = new Uint8Array([0.0, 1.0, 0.0, 1.0]);
        lightSource2.vecPosition = new Uint8Array([0.0, 1.0, -10.0, 1.0]);

        lightSource3.vecDiffuse = new Uint8Array([0.0, 0.0, 1.0, 1.0]);
        lightSource3.vecPosition = new Uint8Array([1.0, 1.0, 0.0, 1.0]);

        environment.matAspect = [
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0
        ];
        if (canvas.width > canvas.height) {
            environment.matAspect[0] = canvas.height / canvas.width;
        } else {
            environment.matAspect[5] = canvas.width / canvas.height;
        }

        //
        // Obtain the projection matrix
        environment.matProjection = projectionPerspectiveFOV(Math.PI / 2, 1.0, 10.0);

        environment.vEye = new Float32Array([0.0, 0.0, 3.0]);
        environment.matView = [
            1, 0, 0, -environment.vEye[0],
            0, 1, 0, -environment.vEye[1],
            0, 0, 1, -environment.vEye[2],
            0, 0, 0, 1
        ];
        environment.matView = transposeMatrix4x4(environment.matView);
    }

    //------------------------------------------------------------------
    //
    // Creates a Perspective Projection matrix based on a requested FOV.
    // The matrix results in the vertices in Normalized Device Coordinates...
    //
    //------------------------------------------------------------------
    function projectionPerspectiveFOV(fov, near, far) {
        let scale = Math.tan(Math.PI * 0.5 - 0.5 * fov);
        let m = [
            scale, 0.0, 0.0, 0.0,
            0.0, scale, 0.0, 0.0,
            0.0, 0.0, -(far + near) / (far - near), -(2 * far * near) / (far - near),
            0.0, 0.0, -1, 0
        ];
        return transposeMatrix4x4(m);
    }

    //------------------------------------------------------------------
    //
    // Prepare and set the Vertex Buffer Object to render.
    //
    //------------------------------------------------------------------
    function initializeBufferObjects() {
        buffers.normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, model.vertexNormals, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        buffers.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, model.vertices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        buffers.vertexColorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexColorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, model.vertexColors, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        buffers.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }

    //------------------------------------------------------------------
    //
    // Prepare and set the shaders to be used.
    //
    //------------------------------------------------------------------
    function initializeShaders() {
        return new Promise((resolve, reject) => {
            //loadFileFromServer('shaders/Prof_Shaders/per-vertex.vs')
            loadFileFromServer('shaders/simple.vs')
                .then(source => {
                    shaders.vertexShader = gl.createShader(gl.VERTEX_SHADER);
                    gl.shaderSource(shaders.vertexShader, source);
                    gl.compileShader(shaders.vertexShader);
                    //return loadFileFromServer('shaders/Prof_Shaders/per-vertex.frag');
                    return loadFileFromServer('shaders/simple.frag');
                })
                .then(source => {
                    shaders.fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
                    gl.shaderSource(shaders.fragmentShader, source);
                    gl.compileShader(shaders.fragmentShader);
                })
                .then(() => {
                    shaders.shaderProgram = gl.createProgram();
                    gl.attachShader(shaders.shaderProgram, shaders.vertexShader);
                    gl.attachShader(shaders.shaderProgram, shaders.fragmentShader);
                    gl.linkProgram(shaders.shaderProgram);

                    resolve();
                })
                .catch(error => {
                    console.log('(initializeShaders) something bad happened: ', error);
                    reject();
                });
        });
    }

    //------------------------------------------------------------------
    //
    // Associate the vertex and pixel shaders, and the expected vertex
    // format with the VBO.
    //
    //------------------------------------------------------------------
    function associateShadersWithBuffers() {
        gl.useProgram(shaders.shaderProgram);

        let ext = gl.getExtension('OES_element_index_uint');

        
        shaders.matAspect = gl.getUniformLocation(shaders.shaderProgram, 'uAspect');
        shaders.matProjection = gl.getUniformLocation(shaders.shaderProgram, 'uProjection');
        shaders.matView = gl.getUniformLocation(shaders.shaderProgram, 'uView');
        shaders.matModel = gl.getUniformLocation(shaders.shaderProgram, 'uModel');

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexBuffer);
        let normal = gl.getAttribLocation(shaders.shaderProgram, 'aNormals');
        gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(normal);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexBuffer);
        let position = gl.getAttribLocation(shaders.shaderProgram, 'aPosition');
        gl.vertexAttribPointer(position, 3, gl.FLOAT, false, model.vertices.BYTES_PER_ELEMENT * 3, 0);
        gl.enableVertexAttribArray(position);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexColorBuffer);
        let color = gl.getAttribLocation(shaders.shaderProgram, 'aColor');
        gl.vertexAttribPointer(color, 3, gl.FLOAT, false, model.vertexColors.BYTES_PER_ELEMENT * 3, 0);
        gl.enableVertexAttribArray(color);

        
    }

    //------------------------------------------------------------------
    //
    // Prepare some WegGL settings, things like the clear color, depth buffer, etc.
    //
    //------------------------------------------------------------------
    function initializeWebGLSettings() {
        gl.clearColor(0.3921568627450980392156862745098, 0.58431372549019607843137254901961, 0.92941176470588235294117647058824, 1.0);
        gl.clearColor(0, 0, 0, 1.0);
        gl.clearDepth(1.0);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.DEPTH_TEST);
    }

    //------------------------------------------------------------------
    //
    // Scene updates go here.
    //
    //------------------------------------------------------------------
    function update(elapsedTime) {
        //
        // Update the rotation matrices
        //model.rotation.x += (model.rotationRate.x * elapsedTime);
        let sinX = Math.sin(model.rotation.x);
        let cosX = Math.cos(model.rotation.x);
        let matRotateX = [
            1, 0, 0, 0,
            0, cosX, -sinX, 0,
            0, sinX, cosX, 0,
            0, 0, 0, 1
        ];
        matRotateX = transposeMatrix4x4(matRotateX);

        model.rotation.y += (model.rotationRate.y * elapsedTime);
        let sinY = Math.sin(model.rotation.y);
        let cosY = Math.cos(model.rotation.y);
        let matRotateY = [
            cosY, 0, sinY, 0,
            0, 1, 0, 0,
            -sinY, 0, cosY, 0,
            0, 0, 0, 1
        ];
        matRotateY = transposeMatrix4x4(matRotateY);
        
        //model.rotation.z += (model.rotationRate.z * elapsedTime);
        let sinZ = Math.sin(model.rotation.z);
        let cosZ = Math.cos(model.rotation.z);
        let matRotateZ = [
            cosZ, -sinZ, 0, 0,
            sinZ, cosZ, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ];
        matRotateZ = transposeMatrix4x4(matRotateZ);

        let matTranslate = [
            1, 0, 0, model.center.x,
            0, 1, 0, model.center.y,
            0, 0, 1, model.center.z,
            0, 0, 0, 1
        ];
        matTranslate = transposeMatrix4x4(matTranslate);

        model.matModel = [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ];
        model.matModel = transposeMatrix4x4(model.matModel);

        model.matModel = multiplyMatrix4x4(matTranslate, model.matModel);
        model.matModel = multiplyMatrix4x4(matRotateX, model.matModel);
        model.matModel = multiplyMatrix4x4(matRotateY, model.matModel);
        model.matModel = multiplyMatrix4x4(matRotateZ, model.matModel);

        if(counter1 === 200){
            randomLight();
            counter1 = 0;
        }
        counter1++;

    }

    function randomLight() {
        var r = parseInt((Math.random() * 3));
        var i = r;
    
        switch(i) {
            case 1:
                lightSource.vecDiffuse = [1,0,0,0];
                lightSource2.vecDiffuse = [0,0,0,0];
                lightSource3.vecDiffuse = [0,0,0,0];
                break;
    
            case 2:
                lightSource2.vecDiffuse = [0,1,0,0];
                lightSource.vecDiffuse = [0,0,0,0];
                lightSource3.vecDiffuse = [0,0,0,0];
                break;
    
            default:
                lightSource3.vecDiffuse = [0,0,1,0];
                lightSource.vecDiffuse = [0,0,0,0];
                lightSource2.vecDiffuse = [0,0,0,0];
                break;
       }
    }


    //------------------------------------------------------------------
    //
    // Rendering code goes here
    //
    //------------------------------------------------------------------
    function render() {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        //
        // This sets which buffers/shaders to use for the draw call in the render function.
        associateShadersWithBuffers();
        gl.uniformMatrix4fv(shaders.matAspect, false, environment.matAspect);
        gl.uniformMatrix4fv(shaders.matProjection, false, environment.matProjection);
        gl.uniformMatrix4fv(shaders.matView, false, environment.matView);
        gl.uniformMatrix4fv(shaders.matModel, false, model.matModel);

        gl.uniform4fv(gl.getUniformLocation(shaders.shaderProgram, "vecAmbient"), lightSource.vecAmbient);
        gl.uniform4fv(gl.getUniformLocation(shaders.shaderProgram, "vecDiffuse"), lightSource.vecDiffuse);
        gl.uniform4fv(gl.getUniformLocation(shaders.shaderProgram, "vecLightPosition"), lightSource.vecPosition);

        gl.uniform4fv(gl.getUniformLocation(shaders.shaderProgram, "vecDiffuse2"), lightSource2.vecDiffuse);
        gl.uniform4fv(gl.getUniformLocation(shaders.shaderProgram, "vecLightPosition2"), lightSource2.vecPosition);

        gl.uniform4fv(gl.getUniformLocation(shaders.shaderProgram, "vecDiffuse3"), lightSource3.vecDiffuse);
        gl.uniform4fv(gl.getUniformLocation(shaders.shaderProgram, "vecLightPosition3"), lightSource3.vecPosition);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBuffer);
        gl.drawElements(gl.TRIANGLES, model.indices.length, gl.UNSIGNED_INT, 0);
    }

    //------------------------------------------------------------------
    //
    // This is the animation loop.
    //
    //------------------------------------------------------------------
    function animationLoop(time) {
        let elapsedTime = previousTime - time;
        previousTime = time;

        update(elapsedTime);
        render();

        requestAnimationFrame(animationLoop);
    }

    console.log('initializing...');
    console.log('    Loading model');
    ModelLoaderPLY.load('models/cube.ply')
    //ModelLoaderPLY.load('models/dodecahedron.ply')
    //ModelLoaderPLY.load('models/120polyhedron.ply')
    //ModelLoaderPLY.load('models/dragon_vrip_res4.ply')
        .then(modelSource => {
            model = modelSource;
            initializeModelRotation(model);
            console.log('    WebGL settings');
            initializeWebGLSettings();
            console.log('    raw data')
            initializeData();
            console.log('    vertex buffer objects');
            initializeBufferObjects();
            console.log('    shaders');
            return initializeShaders();
        })
        .then(() => {
            console.log('initialization complete!');
            requestAnimationFrame(animationLoop);
        });

}());
