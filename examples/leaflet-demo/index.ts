/**
 * This is a minimal example of sigma. You can use it as a base to write new
 * examples, or reproducible test cases for new issues, for instance.
 */

import Graph from "graphology";
import { Coordinates, EdgeDisplayData, NodeDisplayData } from "sigma/types";
import Sigma from "sigma";
import L from "leaflet";
import { pick } from "lodash";
import dataset from "./test_data.json";
import getNodeProgramImage from "sigma/rendering/webgl/programs/node.image";



//TODO : Max bounds on graph

// State to keep the hovered node
let hoveredNode: string | null = null;

// Map creation
// NOTE:
//  - `zoomSnap` is mandatory, it's to allow fraction for zoom level.
//  - you can configure the CRS if you want
const map = L.map("map", {
  zoomControl: false,
  zoomDelta: 0.25,
  zoomSnap: 0,
  zoom: 0
}).setView([0, 0], 0);
L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
  attribution:
   '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
}).addTo(map);


// L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', {
//   attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
// }).addTo(map);


L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
  attribution:
    'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Map style: &copy; <a href="https://www.OpenRailwayMap.org">OpenRailwayMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
}).addTo(map);


const graph = new Graph();
const container = document.getElementById("sigma") as HTMLElement;
const searchInput = document.getElementById("search-input") as HTMLInputElement;
const searchSuggestions = document.getElementById("suggestions") as HTMLDataListElement;
// Sigma creation
// Note:
//  - `stagePadding: 0` is mandatory, so the bbox of the map & Sigma is the same.
//  - node & edge reducer are defined mainly to support node hovered feature


const renderer = new Sigma(graph, container, {
  nodeProgramClasses: {
    image: getNodeProgramImage(),
  },
  // stagePadding: 0,
  // nodeReducer: (node, data) => {
  //   const newData: any = {
  //     ...data,
  //     highlighted: data.highlighted || false,
  //     hidden: false
  //   };
  //   // if there is an hovered node, we only display its neighbour
  //   if (hoveredNode !== null) {
  //     if (node === hoveredNode || graph.neighbors(hoveredNode).includes(node)) {
  //       newData.highlighted = true;
  //     } else {
  //       newData.hidden = true;
  //       newData.highlighted = false;
  //     }
  //   }
  //   return newData;
  // },
  // edgeReducer: (edge, data) => {
  //   const newData: any = { ...data, size: data.weight, hidden: false };
  //   // if there is an hovered node, we only display its neighbour
  //   if (
  //     hoveredNode !== null &&
  //     !graph.extremities(edge).includes(hoveredNode)
  //   ) {
  //     newData.hidden = true;
  //   }
  //   return newData;
  // }
});

//
// Useful functions
//

/**
 * Given a geo point, (ie. [lat, lng]), returns its graph coords (ie. {x, y}).
 */
function latlngToGraph(coord: [number, number]): { x: number; y: number } {
  const geoProjection = pick(map.project(coord, 0), ["x", "y"]);
  const graphDimensions = renderer.getDimensions();
  return {
    x: geoProjection.x,
    // Y are reversed between geo / sigma
    y: graphDimensions.height - geoProjection.y
  };
}

/**
 * Given a graph coords (ie. {x,y}), return it's lat/lng (ie. [lat, lng]).
 */
function graphToLatlng(coords: { x: number; y: number }): [number, number] {
  const graphDimensions = renderer.getDimensions();
  // Y are reversed between geo / sigma
  const geoUnprojected = map.unproject(
    [coords.x, graphDimensions.height - coords.y],
    0
  );
  return [geoUnprojected.lat, geoUnprojected.lng];
}

// *
//  * Synchronise the sigma BBOX with the leaflet one.
//  *
 // * @param animated If true, performs a fitBounds instead of a flyToBounds
 
function syncLeafletBboxWithGraphBbox(animated = true): void {
  // Graph BBOX
  const graphDimensions = renderer.getDimensions();
  const graphTopLeft = renderer.viewportToGraph({ x: 0, y: 0 });
  const graphBottomRight = renderer.viewportToGraph({
    x: graphDimensions.width,
    y: graphDimensions.height
  });
  const geoTopLeft = graphToLatlng(graphTopLeft);
  const geoBottomRight = graphToLatlng(graphBottomRight);
  // Set map BBOX
  map.flyToBounds([geoTopLeft, geoBottomRight], {
    animate: false,
    duration: 0.01
  });
}

// Build the dataset as a graph
// We load the dataset from the JSON, and for each node, we compute its (x,y) coords
// by using the CRS projection of the map (see `latlngToGraph` function)
const gd = new Graph();
gd.import(dataset as any);
gd.nodes().forEach((node) => {
  gd.updateNodeAttributes(node, (data) => {
    const graphProjection = latlngToGraph([data.latitude, data.longitude]);
    return {
      label: data.fullName,
      size: data.size,
      color: data.color,
      type: data.type,
      image: data.image,
      ...graphProjection
    };
  });
});
// load the computed graph into the sigma one
graph.import(gd);
// refresh Sigma
renderer.refresh();

// Register event to manage state hoveredNode
renderer.on("enterNode", (event) => {
  hoveredNode = event.node;
  renderer.refresh();
});
renderer.on("leaveNode", () => {
  hoveredNode = null;
  renderer.refresh();
});

// Sync sigma camera with graph
renderer.getCamera().on("updated", () => syncLeafletBboxWithGraphBbox());

// Init the bbx between sigma & leaflet
syncLeafletBboxWithGraphBbox(false);

// Type and declare internal state:
interface State {
  hoveredNode?: string;
  searchQuery: string;

  // State derived from query:
  selectedNode?: string;
  suggestions?: Set<string>;

  // State derived from hovered node:
  hoveredNeighbors?: Set<string>;
}
const state: State = { searchQuery: "" };

// Feed the datalist autocomplete values:
searchSuggestions.innerHTML = graph
  .nodes()
  .map((node) => `<option value="${graph.getNodeAttribute(node, "label")}"></option>`)
  .join("\n");

// Actions:
function setSearchQuery(query: string) {
  state.searchQuery = query;

  if (searchInput.value !== query) searchInput.value = query;

  if (query) {
    const lcQuery = query.toLowerCase();
    const suggestions = graph
      .nodes()
      .map((n) => ({ id: n, label: graph.getNodeAttribute(n, "label") as string }))
      .filter(({ label }) => label.toLowerCase().includes(lcQuery));

    // If we have a single perfect match, them we remove the suggestions, and
    // we consider the user has selected a node through the datalist
    // autocomplete:
    if (suggestions.length === 1 && suggestions[0].label === query) {
      state.selectedNode = suggestions[0].id;
      state.suggestions = undefined;

      // Move the camera to center it on the selected node:
      const nodePosition = renderer.getNodeDisplayData(state.selectedNode) as Coordinates;
      renderer.getCamera().animate(nodePosition, {
        duration: 500,
      });
    }
    // Else, we display the suggestions list:
    else {
      state.selectedNode = undefined;
      state.suggestions = new Set(suggestions.map(({ id }) => id));
    }
  }
  // If the query is empty, then we reset the selectedNode / suggestions state:
  else {
    state.selectedNode = undefined;
    state.suggestions = undefined;
  }

  // Refresh rendering:
  renderer.refresh();
}
function setHoveredNode(node?: string) {
  if (node) {
    state.hoveredNode = node;
    state.hoveredNeighbors = new Set(graph.neighbors(node));
  } else {
    state.hoveredNode = undefined;
    state.hoveredNeighbors = undefined;
  }

  // Refresh rendering:
  renderer.refresh();
}

// Bind search input interactions:
searchInput.addEventListener("input", () => {
  setSearchQuery(searchInput.value || "");
});
searchInput.addEventListener("blur", () => {
  setSearchQuery("");
});

// Bind graph interactions:
renderer.on("enterNode", ({ node }) => {
  setHoveredNode(node);
});
renderer.on("leaveNode", () => {
  setHoveredNode(undefined);
});

// Render nodes accordingly to the internal state:
// 1. If a node is selected, it is highlighted
// 2. If there is query, all non-matching nodes are greyed
// 3. If there is a hovered node, all non-neighbor nodes are greyed
renderer.setSetting("nodeReducer", (node, data) => {
  const res: Partial<NodeDisplayData> = { ...data };

  if (state.hoveredNeighbors && !state.hoveredNeighbors.has(node) && state.hoveredNode !== node) {
    res.label = "";
    res.color = "#f6f6f6";
  }

  if (state.selectedNode === node) {
    res.highlighted = true;
  } 
  else if (state.suggestions && !state.suggestions.has(node)) {
    res.label = "";
    res.color = "#f6f6f6";
  }

  return res;
});

// Render edges accordingly to the internal state:
// 1. If a node is hovered, the edge is hidden if it is not connected to the
//    node
// 2. If there is a query, the edge is only visible if it connects two
//    suggestions
renderer.setSetting("edgeReducer", (edge, data) => {
  const res: Partial<EdgeDisplayData> = { ...data };

  if (state.hoveredNode && !graph.hasExtremity(edge, state.hoveredNode)) {
    res.hidden = true;
  }

  if (state.suggestions && (!state.suggestions.has(graph.source(edge)) || !state.suggestions.has(graph.target(edge)))) {
    res.hidden = true;
  }

  return res;
});
