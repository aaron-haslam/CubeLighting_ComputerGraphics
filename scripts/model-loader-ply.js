ModelLoaderPLY = (function() {
    'use strict';

    function defineModel(fileLines) {
        let model = {
            file: "",
            format: {
                type: "",
                version: "",
            },
            element: {
                vertex: 0,
                face: 0,
            },
            property: {
                x: null,
                y: null,
                z: null,
                list: null,
            },
            vertices: null,
            vertexColors: null,
            indices: null,
            vertexNormals: null,
            center: {
                x: 0,
                y: 0,
                z: 0
            }
        };

        if(fileLines[0] === "ply"){
            model.file = fileLines[0];

            let headerCompleted = false;
            let startOfVertices = 0;
            let startOfFaces = 0;
            let endOfVertices = 0;
            let endOfFaces = 0;

            while(headerCompleted === false){
                for(let k = 1; k < fileLines.length; k++ ){
                    let line = fileLines[k].split(" ");

                    for(let i = 0; i < line.length; i++){
                        if (line[i] === "format"){
                            model.format.type = line[1];
                            model.format.version = line[2];
                            continue;
                        }else if(line[i] === "element"){
                            i++;
                            if(line[i] === "vertex"){
                                i++;
                                model.element.vertex = parseInt(line[i]);
                            }else if(line[i] === "face"){
                                i++;
                                model.element.face = parseInt(line[i]);
                            }
                            continue;
                        }else if(line[i] === "property"){
                            i++;
                            if(line[i] === "float"){
                                i++;
                                if(line[i] === "x"){
                                    model.property.x = line[i-1];
                                }else if(line[i] === "y"){
                                    model.property.y = line[i-1];
                                }else if(line[i] === "z"){
                                    model.property.z = line[i-1];
                                }
                            }else if(line[i] === "list"){
                                model.property.list = line;
                            }
                            continue;
                        }else if(line[i] === "end_header"){
                            startOfVertices = k+1;
                            endOfVertices = startOfVertices + model.element.vertex - 1;
                            startOfFaces = startOfVertices + model.element.vertex;
                            endOfFaces = startOfFaces + model.element.face - 1;
                            headerCompleted = true;
                        }
                    }
                }  
            }

            let k = 0;
            model.vertices = new Float32Array(model.element.vertex * 3);
            model.vertexNormals = new Float32Array(model.element.vertex * 3);

            for(let i = startOfVertices; i <= endOfVertices; i++){
                let line = fileLines[i].split(" ");

                for(let j = 0; j < line.length; j++){
                    if(line[j] !== " " && line[j] !== "" && line[j] !== "\r" && line[j] !== "\n"){
                        model.vertices[k] = parseFloat(line[j]);
                        k++;
                    }
                }
            }

            

            k = 0;
            let numOfTriangles = 0;
            model.indices = new Uint32Array(model.element.face * 3);
            for(let i = startOfFaces; i <= endOfFaces; i++){
                let line = fileLines[i].split(" ");

                numOfTriangles = parseInt(line[0])-2;

                for(let w = 1; w <= numOfTriangles; w++){
                    if(line[w] !== ""){
                        model.indices[k] = parseFloat(line[1]);
                        k++;
                    }
                    if(line[w] !== ""){
                        model.indices[k] = parseFloat(line[w+1]);
                        k++;
                    }
                    if(line[w+1] !== ""){
                        model.indices[k] = parseFloat(line[w+2]);
                        k++;
                    }
                }
            }

            model.vertexColors = new Float32Array(model.element.vertex * 3);
            for(let i = 0; i < model.vertices.length; i++){
                model.vertexColors[i] = 1.0;
                model.vertexColors[i+1] = 1.0;
                model.vertexColors[i+2] = 1.0;
                i+=2;
            }

            model.center = {
                x: 0.0,
                y: 0.0,
                z: 0.0
            }


            model.vertices = normalizeArray(model.vertices);


            findvertexNormals(model);

            
            model.vertexNormals = normalizeArray(model.vertexNormals);
        }
        else{
            console.log("NOT A PLY FILE");
        }        
        console.log(model);
        return model;
    }

    function findvertexNormals(model){
        //------------------------------------------------------------------
        //
        // Create new object from model
        //
        //------------------------------------------------------------------
        let allVertices = [];
        for(let i = 0; i < model.vertices.length; i+=3){
            let vertex = {
                position: {x:0,y:0,z:0},
                normal: {x:0,y:0,z:0},
                allvertexNormals: []
            };
            vertex.position.x = model.vertices[i];
            vertex.position.y = model.vertices[i+1];
            vertex.position.z = model.vertices[i+2];
            allVertices.push(vertex);
        }

        //------------------------------------------------------------------
        //
        // Compute face normals
        //
        //------------------------------------------------------------------
        model.vertexNormals = new Float32Array(model.element.vertex * 3);

        for(let i = 0; i < model.indices.length; i+=3){
            let p1 = allVertices[model.indices[i]];
            let p2 = allVertices[model.indices[i+1]];
            let p3 = allVertices[model.indices[i+2]];

            let normal = computeFaceNormalofTriangle(p1,p2,p3);

            p1.allvertexNormals.push(normal);
            p2.allvertexNormals.push(normal);
            p3.allvertexNormals.push(normal);
        }

        //------------------------------------------------------------------
        //
        // Find average of all shared faces to get vertex normals
        //
        //------------------------------------------------------------------
        for(let i = 0; i < allVertices.length; i++){
            allVertices[i].normal = findAverageofAllvertexNormals(allVertices[i].allvertexNormals);
        }

        //------------------------------------------------------------------
        //
        // Put all vertex normals into array in model
        //
        //------------------------------------------------------------------

        model.vertexNormals = new Float32Array(model.element.vertex * 3);

        let j = 0;
        for(let i = 0; i < allVertices.length; i++){
            model.vertexNormals[j] = allVertices[i].normal.x;
            model.vertexNormals[j+1] = allVertices[i].normal.y;
            model.vertexNormals[j+2] = allVertices[i].normal.z;
            j+=3;
        }
    }
    function normalizeArray(array){
        let max = Math.abs(array[0]);
        let min = Math.abs(array[0]);


        for(let i = 0; i < array.length; i++){
            if(Math.abs(array[i]) > max){
                max = Math.abs(array[i]);
            }
            if(Math.abs(array[i]) < min){
                min = Math.abs(array[i]);
            }
        }

        for(let i = 0; i < array.length; i++){
            array[i] = (array[i] - min)/(max - min);
        }

        return array;
    }
    function computeFaceNormalofTriangle(p1,p2,p3){
        let v = {
            x: p1.position.x-p3.position.x,
            y: p1.position.y-p3.position.y,
            z: p1.position.z-p3.position.z
        }
        let w = {
            x: p2.position.x-p3.position.x,
            y: p2.position.y-p3.position.y,
            z: p2.position.z-p3.position.z
        }

        let normal = {
            x: w.y*v.z - w.z*v.y,
            y: w.z*v.x - w.x*v.z,
            z: w.x*v.y - w.y*v.x
        }

        normal = normalizeVector(normal)

        return normal;
    }
    function normalizeVector(point){
        let out = {x:0,y:0,z:0};

        let x = point.x;
        let y = point.y;
        let z = point.z;

        let length = x*x + y*y + z*z;

        if (length > 0){
            length = 1/Math.sqrt(length);
            out.x = point.x * length;
            out.y = point.y * length;
            out.z = point.z * length;
        }

        return out;
    }
    function findAverageofAllvertexNormals(allvertexNormals){
        let xSum = 0;
        let ySum = 0;
        let zSum = 0;
        let totalNumber = allvertexNormals.length;
        for(let i = 0; i < totalNumber; i++){
            xSum += allvertexNormals[i].x;
            ySum += allvertexNormals[i].y;
            zSum += allvertexNormals[i].z;
        }

        let temp = {x:0,y:0,z:0};

        temp.x = xSum/totalNumber;
        temp.y = ySum/totalNumber;
        temp.z = zSum/totalNumber;

        return temp;
    }

    //------------------------------------------------------------------
    //
    // Loads and parses a PLY formatted file into an object ready for
    // rendering.
    //
    //------------------------------------------------------------------
    function load(file) {
        return new Promise((resolve, reject) => {
            loadFileFromServer(file)
            .then(fileText => {
                let fileLines = fileText.split(/\r?\n/);
                let model = defineModel(fileLines);
                resolve(model);
            })
            .catch(error => {
                reject(error);
            });
        });
    }

    return {
        load : load
    };

}());
