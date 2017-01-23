const width = window.innerWidth * 0.9,
    height = window.innerHeight * 0.9,
    // edgeSimilarityThreshold = 0.995,
    cachedSecondaryConceptCount = 10,
    linkDistance = 75,
    primaryConceptCids = [
        "ee620923ff5fc510555dc37083a135ee", // JavaScript
        "6d85b2d399967a027efc0d611a548da5", // ECMAScript
        "c98269563aae1fc073b7fc0372efa1a1", // Netscape
        "dbac364f8380e97e441c2d96f35248b3", // Brendan Eich
        "76d5733b82b9b85e7c7c9538c8b1cbf3", // Internet Explorer
        "0cdd3ec3701bb6cbed75fda61aec3084", // Red wine
        "8ea4663bcabfd59c9432925a8293b4cb", // Winemaking
        "215865868473ecf27745ea7e0f56ed04", // Barack Obama
    ];

class Graph {
    constructor() {
        this.nodeData = [];
        this.edgeData = [];
        this.primaryConcepts = [];
        this.isPresentingLabels = false;
        this.isPresentingFoci = false;
        this.root = d3.select("#graph");
    }

    initWith(rawData) {
        if (this.nodeData.length) {
            this.clear();
            this.nodeData = [];
            this.edgeData = [];
            this.primaryConcepts = [];
        }
        this.process(rawData);
        this.prepareSimulation();
        this.renderGraph();
    }

    filterCentroidEdgesFrom(rawEdgeData) {
        const results = [];
        let isConnectedToACentroid, isDuplicate;
        for (let edgeDatum of rawEdgeData) {
            isConnectedToACentroid = this.primaryConcepts.hasOwnProperty(edgeDatum.source) ||
                this.primaryConcepts.hasOwnProperty(edgeDatum.target);
            isDuplicate = results.some(function (_edgeDatum) {
                return (_edgeDatum.source === edgeDatum.source && _edgeDatum.target === edgeDatum.target) ||
                    (_edgeDatum.source === edgeDatum.target && _edgeDatum.target === edgeDatum.source);
            });
            // isAboveThreshold = edgeDatum.similarity > edgeSimilarityThreshold;
            if (isConnectedToACentroid && !isDuplicate) {
                results.push(edgeDatum);
            }
        }
        return results;
    }

    process(rawData) {
        const rawNodeData = [],
            rawEdgeData = [],
            self = this;

        for (let rawDatum of rawData) {
            this.primaryConcepts[rawDatum.data.centroids[0]] = {};
            for (let node of rawDatum.data.nodes) {
                node.primaryConceptCid = rawDatum.data.centroids[0];
            }
            Array.prototype.push.apply(rawNodeData, rawDatum.data.nodes);
            Array.prototype.push.apply(rawEdgeData, rawDatum.data.edges);
        }

        this.edgeData = this.filterCentroidEdgesFrom(rawEdgeData);

        const primaryConceptCount = Object.keys(this.primaryConcepts).length;

        console.log(primaryConceptCount, rawNodeData.length, rawEdgeData.length);

        const nodeMapping = {},
            vertexCoordinates = Graph.polygonVertexCoordinatesFrom(
                width / 2,
                height / 2,
                height / 3,
                primaryConceptCount
            ),
            focusCoordinates = Graph.polygonVertexCoordinatesFrom(
                width / 2,
                height / 2,
                height / 3 + linkDistance + 20, // position outside of polygon
                primaryConceptCount
            );

        Object.keys(this.primaryConcepts).forEach(function (cid, i) {
            self.primaryConcepts[cid].vertexCoordinates = vertexCoordinates[i];
            self.primaryConcepts[cid].focusCoordinates = focusCoordinates[i];
        });

        let isCentroid, isDuplicate;
        for (let nodeDatum of rawNodeData) {
            if (!nodeMapping[nodeDatum.cId]) {
                // Create mapping for high-performance filtering of edge data
                nodeMapping[nodeDatum.cId] = true;
                isDuplicate = false;
            } else {
                isDuplicate = true;
            }

            isCentroid = this.primaryConcepts.hasOwnProperty(nodeDatum.cId);

            if (!isDuplicate) {
                // Set node starting positions
                if (isCentroid) {
                    nodeDatum.x = this.primaryConcepts[nodeDatum.cId].vertexCoordinates.x;
                    nodeDatum.y = this.primaryConcepts[nodeDatum.cId].vertexCoordinates.y;
                    nodeDatum.fx = this.primaryConcepts[nodeDatum.cId].vertexCoordinates.x;
                    nodeDatum.fy = this.primaryConcepts[nodeDatum.cId].vertexCoordinates.y;
                    nodeDatum.isCentroid = true;
                } else {
                    nodeDatum.x = this.primaryConcepts[nodeDatum.primaryConceptCid].focusCoordinates.x + Math.random();
                    nodeDatum.y = this.primaryConcepts[nodeDatum.primaryConceptCid].focusCoordinates.y + Math.random();
                }
                this.nodeData.push(nodeDatum);
            }
        }
    }

    /**
     * GIVEN x and y (the center coordinates), the radius and the number of polygon sides returns an
     * array of vertex coordinates
     * @param x
     * @param y
     * @param radius
     * @param sides
     * @returns []Coordinates
     * @see http://bl.ocks.org/fabiovalse/8543484
     */
    static polygonVertexCoordinatesFrom(x, y, radius, sides) {
        const coordinates = [];
        if (sides === 1) {
            coordinates.push({x, y});
        } else {
            for (let i = 0; i < sides; i++) {
                coordinates.push({
                    x: x + (Math.sin(2 * Math.PI * i / sides) * radius),
                    y: y - (Math.cos(2 * Math.PI * i / sides) * radius),
                });
            }
        }
        return coordinates;
    }

    prepareSimulation() {
        const self = this;

        const forceLink = d3.forceLink()
            .id(function (d) {return d.cId;})
            // .strength(.1)
            .distance(linkDistance)
            .iterations(10)

        const charge = d3.forceManyBody()
            .strength(-300)
            // .theta(0.1)
            // .distanceMin(100)
            // .distanceMax(100)

        const forceX = d3.forceX(function (d) {
            return (self.primaryConcepts[d.primaryConceptCid] && !d.isCentroid) ?
                self.primaryConcepts[d.primaryConceptCid].focusCoordinates.x : 0;
        });
        const forceY = d3.forceY(function (d) {
            return (self.primaryConcepts[d.primaryConceptCid] && !d.isCentroid) ?
                self.primaryConcepts[d.primaryConceptCid].focusCoordinates.y : 0;
        });

        this.simulation = d3.forceSimulation()
            // .force("center", d3.forceCenter(width / 2, height / 2))
            .force("link", forceLink)
            .force("charge", charge)
            // .velocityDecay(.1)
            // .alpha(1)
            // .alphaDecay(.1)
            .force("collide", d3.forceCollide(10))
            .force("x", forceX.strength(.3))
            .force("y", forceY.strength(.3))
    }

    renderGraph() {
        const self = this;

        this.simulation
            .nodes(this.nodeData)
            // .on("tick", this.simulationTick.bind(this));

        this.simulation
            .force("link")
            .links(this.edgeData);

        // Partially pre-render graph
        // @see http://bl.ocks.org/mbostock/1667139
        this.simulation.stop();
        for (let i = 0, n = Math.ceil(Math.log(this.simulation.alphaMin()) / Math.log(1 - this.simulation.alphaDecay())); i < n; ++i) {
            this.simulation.tick();
        }
        // this.simulation.restart();

        this.links = this.root.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(this.edgeData)
            .enter()
            .append("line")
            .attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });

        this.foci = this.root.append("g")
            .attr("class", "foci")
            .style("opacity", 0)
            .selectAll("circle")
            .data(Object.values(this.primaryConcepts))
            .enter()
            .append("circle")
            .attr("r", 10)
            .attr('cx', function (datum) {
                return datum.focusCoordinates.x;
            })
            .attr('cy', function (datum) {
                return datum.focusCoordinates.y;
            });

        this.nodes = this.root.append("g")
            .attr("class", "nodes")
            .selectAll("g")
            .data(this.nodeData)
            .enter()
            .append("g")
            // For styling centroid differently than other nodes
            .classed("primary-concept", function (datum) {
                return self.primaryConcepts.hasOwnProperty(datum.cId);
            })
            .attr("transform", function (d) { return `translate(${d.x}, ${d.y})`; });

        this.nodes.append("circle")
            .attr("r", function (datum) {
                return self.primaryConcepts.hasOwnProperty(datum.cId) ? 10 : 5;
            });

        this.nodes.append("text")
            .attr("dx", function (datum, i) {
                return self.primaryConcepts.hasOwnProperty(datum.cId) ? 15 : 10;
            })
            .attr("dy", ".35em")
            .style("opacity", function (d) {return d.isCentroid ? 1 : 0;})
            .text(function (d) {return d.title;});
    }

    simulationTick() {
        const transition = d3.transition().duration(250).ease(d3.easeLinear);
        this.nodes.transition(transition)
            .attr("transform", function (d) { return `translate(${d.x}, ${d.y})`; });

        this.links.transition(transition)
            .attr("x1", function (d) { return d.source.x; })
            .attr("y1", function (d) { return d.source.y; })
            .attr("x2", function (d) { return d.target.x; })
            .attr("y2", function (d) { return d.target.y; });
    }

    toggleDisplayLabel() {
        this.isPresentingLabels = !this.isPresentingLabels;
        const opacity = this.isPresentingLabels ? 1 : 0;
        this.root.selectAll(".nodes g:not(.primary-concept) text").style("opacity", opacity);
    }

    toggleFociDisplay() {
        this.isPresentingFoci = !this.isPresentingFoci;
        const opacity = this.isPresentingFoci ? 1 : 0;
        this.root.select("g.foci").style("opacity", opacity);
    }

    clear() {
        this.root.selectAll("*").remove()
    }
}

document.getElementById("label-display-toggle")
    .addEventListener("click", function () {
        graph.toggleDisplayLabel();
    });

document.getElementById("foci-display-toggle")
    .addEventListener("click", function () {
        graph.toggleFociDisplay();
    });

document.getElementById("3d-toggle")
    .addEventListener("click", function () {
        graphElement.classList.toggle("is-3d");

        let cloneCount = 1;
        const clones = document.getElementsByClassName("graph-clone");
        function clone() {
            const graph2 = graphElement.cloneNode(true);
            graph2.removeAttribute("id");
            graph2.classList.add("graph-clone");
            graph2.style.opacity = 0;
            graphElement.parentNode.appendChild(graph2);
            setTimeout(function () {
                graph2.style.transform = `rotateX(45deg) scale(0.5) translateZ(-${100 * cloneCount}px)`;
                graph2.style.opacity = 1;
                cloneCount++;
                if (cloneCount < 5) {
                    clone();
                }
            }, 50);
        }
        if (!clones.length) {
            clone();
        } else {
            for (let clone of clones) {
                clone.classList.toggle("is-hidden");
            }
        }
    });

const primaryConceptCountControl = document.getElementById("primary-concept-count"),
    secondaryConceptCountControl = document.getElementById("secondary-concept-count"),
    activityIndicator = document.getElementById("activity-indicator"),
    graphElement = document.getElementById("graph");

primaryConceptCountControl.addEventListener("change", function () {
    fetchDataFor(primaryConceptCountControl.value, secondaryConceptCountControl.value)
        .then(function (rawData) {
            graph.initWith(rawData);
        })
        .catch(function (error) {
            activityIndicator.innerHTML = error.message;
            activityIndicator.style.opacity = 1;
        });
});

secondaryConceptCountControl.addEventListener("change", function () {
    fetchDataFor(primaryConceptCountControl.value, secondaryConceptCountControl.value)
        .then(function (rawData) {
            graph.initWith(rawData);
        })
        .catch(function (error) {
            activityIndicator.innerHTML = error.message;
            activityIndicator.style.opacity = 1;
        });
});

function fetchDataFor(primaryConceptCount, secondaryConceptCount) {
    activityIndicator.innerHTML = "Fetching data...";
    activityIndicator.style.opacity = 1;

    const fetchCachedData = primaryConceptCount === primaryConceptCids.length &&
        secondaryConceptCount === cachedSecondaryConceptCount;
    const dataUris = fetchCachedData ?
        primaryConceptCids.map(function (cid) {
            return `data/${cid}.json`;
        }) :
        primaryConceptCids.map(function (cid) {
            return `https://api.yewno.com/concepts/${cid}?format=adjacency-list&edges=${secondaryConceptCount}`;
        });

    const fetches = dataUris.slice(0, primaryConceptCount).map(function (dataUri) {
        return fetch(dataUri);
    });

    return Promise.all(fetches)
        .then(function (responses) {
            const promises = responses.map(function (response) {
                return response.json();
            });
            return Promise.all(promises).then(function (data) {
                activityIndicator.style.opacity = 0;
                activityIndicator.innerHTML = "";
                return data;
            })
        });
}

const graph = new Graph();
fetchDataFor(primaryConceptCids.length, 10)
    .then(function (rawData) {
        graph.initWith(rawData);
    })
    .catch(function (error) {
        activityIndicator.innerHTML = error.message;
        activityIndicator.style.opacity = 1;
    });
