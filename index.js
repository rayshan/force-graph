const svg = d3.select("#graph"),
    width = window.innerWidth,
    height = window.innerHeight,
    edgeSimilarityThreshold = 0.995,
    dataUri =
        "https://api.yewno.com/concepts/ee620923ff5fc510555dc37083a135ee?format=adjacency-list&edges=30";

const forceLink = d3.forceLink()
    .id(function (d) { return d.cId; })
    .distance(function (link) {
        return (link.similarity - edgeSimilarityThreshold) * 200000;
    });

const simulation = d3.forceSimulation()
    .force("link", forceLink)
    .force("center", d3.forceCenter(width / 2, height / 2));

d3.json(dataUri, function (error, data) {
    if (error) throw error;

    const nodeData = data.data.nodes,
        centroidCId = data.data.centroids[0],
        nodeMapping = {},
        linkData = [];

    for (let nodeDatum of nodeData) {
        // Force centroid to be in the middle of viewport
        if (nodeDatum.cId === centroidCId) {
            nodeDatum.fx = width / 2;
            nodeDatum.fy = height / 2;
        }
        // Create mapping for high-performance filtering of edge data
        nodeMapping[nodeDatum.cId] = 0;
    }

    // Filter many useless, duplicate and below-threshold edge data
    let edgeDatum, isInNodeData, isDuplicate, isAboveThreshold;
    for (edgeDatum of data.data.edges) {
        isInNodeData = typeof nodeMapping[edgeDatum.source] !== "undefined" &&
            typeof nodeMapping[edgeDatum.target] !== "undefined";
        isDuplicate = linkData.some(function (linkDatum) {
            return linkDatum.source === edgeDatum.target && linkDatum.target === edgeDatum.source;
        });
        isAboveThreshold = edgeDatum.similarity > edgeSimilarityThreshold;
        if (isInNodeData && !isDuplicate && isAboveThreshold) {
            nodeMapping[edgeDatum.source] += 1;
            nodeMapping[edgeDatum.target] += 1;
            linkData.push(edgeDatum);
        }
    }

    const links = svg.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(linkData)
        .enter()
        .append("line");

    const dragController = d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);

    const nodes = svg.append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(nodeData)
        .enter()
        .append("g")
        // For styling centroid differently than other nodes
        .classed("centroid", function (datum) {
            return datum.cId === centroidCId;
        })
        .call(dragController);

    nodes.append("circle")
        .attr("r", function (datum) {
            return datum.cId === centroidCId ? 10 : 5;
        });

    nodes.append("text")
        .attr("dx", function (datum) {
            return datum.cId === centroidCId ? 15 : 10;
        })
        .attr("dy", ".35em")
        .text(function (d) { return d.title });

    simulation
        .nodes(nodeData)
        .on("tick", ticked);

    simulation.force("link")
        .links(linkData);

    function ticked() {
        links
            .attr("x1", function (d) { return d.source.x; })
            .attr("y1", function (d) { return d.source.y; })
            .attr("x2", function (d) { return d.target.x; })
            .attr("y2", function (d) { return d.target.y; });

        nodes.attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });
    }
});

function dragstarted(d) {
    if (!d3.event.active) {
        simulation.alphaTarget(0.3)
            .restart();
    }
    d.fx = d.x;
    d.fy = d.y;
}

function dragged(d) {
    d.fx = d3.event.x;
    d.fy = d3.event.y;
}

function dragended(d) {
    if (!d3.event.active) {
        simulation.alphaTarget(0);
    }
    d.fx = null;
    d.fy = null;
}

