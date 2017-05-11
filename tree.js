const width = window.innerWidth * 0.9,
    height = window.innerHeight * 0.9,
    dataDescriptors = [
        {
            label: "1 primary concept, many secondary concepts",
            filenamePrefix: "1-pc-many-sc",
        },
        {
            label: "2 primary concepts",
            filenamePrefix: "2-pc",
        },
        {
            label: "2 primary concepts, many secondary concepts",
            filenamePrefix: "2-pc-many-sc",
        },
        {
            label: "3 primary concepts, many secondary concepts",
            filenamePrefix: "3-pc-many-sc",
        },
    ];

class ForceDirectedGraph {
    constructor() {
        this.data = undefined;
        this.root = d3.select("#graph-root");
    }

    initWith(rawData) {
        this.clear();
        this.data = rawData.tree;
        this.prepareSimulation();
        this.renderGraph();
    }

    prepareSimulation() {
        this.g = this.root.append("g").attr("transform", "translate(100,0)");
        this.tree = d3.tree().size([height, width - 300]);
    }

    renderGraph() {
        const treeRoot = d3.hierarchy(this.data);

        const link = this.g.selectAll(".link")
            .data(this.tree(treeRoot).descendants().slice(1))
            .enter().append("path")
            .attr("class", "link")
            .attr("d", function (d) {
                return "M" + d.y + "," + d.x
                    + "C" + (d.y + d.parent.y) / 2 + "," + d.x
                    + " " + (d.y + d.parent.y) / 2 + "," + d.parent.x
                    + " " + d.parent.y + "," + d.parent.x;
            });

        const node = this.g.selectAll(".node")
            .data(treeRoot.descendants())
            .enter().append("g")
            .attr("class", d => "node " + (d.children ? "internal" : "leaf"))
            .attr("transform", d => "translate(" + d.y + "," + d.x + ")");

        node.append("circle")
            .attr("r", d => d.children ? 8 : 3);

        node.append("text")
            .attr("dy", 3)
            .attr("x", d => d.children ? -12 : 8)
            .style("text-anchor", d => d.children ? "end" : "start")
            .text(d => d.data.name);
    }

    clear() {
        this.root.selectAll("*").remove()
    }
}

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

document.getElementById("input-screenshot-toggle")
    .addEventListener("click", function () {
        inputScreenshot.style.display =
            inputScreenshot.style.display === "block" ? null : "block";
    });

const dataSelector = document.getElementById("data-selector"),
    activityIndicator = document.getElementById("activity-indicator"),
    inputScreenshot = document.getElementById("input-screenshot"),
    graphElement = document.getElementById("graph");

function updateInputScreenshotWith(filenamePrefix) {
    inputScreenshot.style.backgroundImage =
        `url(data/tree/${filenamePrefix}.png)`;
}

dataSelector.addEventListener("change", function (event) {
    const filenamePrefix = event.target.value;
    updateInputScreenshotWith(filenamePrefix);
    fetchDataWith(filenamePrefix)
        .then(function (rawData) {
            graph.initWith(rawData);
        })
        .catch(function (error) {
            activityIndicator.innerHTML = error.message;
            activityIndicator.style.opacity = 1;
        });
});

function createSelectOptionsFor(dataDescriptors) {
    let option;
    dataDescriptors.forEach(function (dataDescriptor, i) {
        option = document.createElement("option");
        option.value = dataDescriptor.filenamePrefix;
        option.text = dataDescriptor.label;
        dataSelector.appendChild(option);
    });
}

function fetchDataWith(filenamePrefix) {
    activityIndicator.innerHTML = "Fetching data...";
    activityIndicator.style.opacity = 1;
    const dataFilePath = `data/tree/${filenamePrefix}.json`;
    return fetch(dataFilePath)
        .then(function (response) {
            activityIndicator.style.opacity = 0;
            activityIndicator.innerHTML = "";
            return response.json();
        });
}

createSelectOptionsFor(dataDescriptors);

const graph = new ForceDirectedGraph();
const initialFilename = dataDescriptors[0].filenamePrefix;
updateInputScreenshotWith(initialFilename);
fetchDataWith(initialFilename)
    .then(function (rawData) {
        graph.initWith(rawData);
    })
    .catch(function (error) {
        console.error(error)
        activityIndicator.innerHTML = error.message;
        activityIndicator.style.opacity = 1;
    });
