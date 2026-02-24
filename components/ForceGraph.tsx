"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Executive, Relationship, GraphData, Region, RelType } from "@/lib/types";
import { REGION_COLOR, REL_COLOR } from "@/lib/types";

interface Props {
  data: GraphData;
  selectedId: number | null;
  onSelectNode: (exec: Executive) => void;
  filterRegion: Region | "ALL";
  filterRelType: RelType | "ALL";
  searchName: string;
}

export default function ForceGraph({
  data,
  selectedId,
  onSelectNode,
  filterRegion,
  filterRelType,
  searchName,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(async () => {
    if (!svgRef.current || !containerRef.current) return;
    const d3 = await import("d3");

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;
    svgRef.current.setAttribute("width", String(width));
    svgRef.current.setAttribute("height", String(height));

    // ── filter nodes ─────────────────────────────────────
    const searchLower = searchName.toLowerCase();
    const visibleNodes = data.nodes.filter((n) => {
      if (filterRegion !== "ALL" && n.region !== filterRegion) return false;
      if (searchLower && !n.name.toLowerCase().includes(searchLower) &&
          !n.company.toLowerCase().includes(searchLower) &&
          !n.extracted.schools.some((s) => s.toLowerCase().includes(searchLower))) return false;
      return true;
    });
    const visibleIds = new Set(visibleNodes.map((n) => n.id));

    const visibleLinks = data.links.filter((l) => {
      const sid = typeof l.source === "object" ? l.source.id : (l.source as number);
      const tid = typeof l.target === "object" ? l.target.id : (l.target as number);
      if (!visibleIds.has(sid) || !visibleIds.has(tid)) return false;
      if (filterRelType !== "ALL" && l.type !== filterRelType) return false;
      return true;
    });

    // ── degree ────────────────────────────────────────────
    const degree = new Map<number, number>();
    visibleLinks.forEach((l) => {
      const sid = typeof l.source === "object" ? l.source.id : (l.source as number);
      const tid = typeof l.target === "object" ? l.target.id : (l.target as number);
      degree.set(sid, (degree.get(sid) || 0) + 1);
      degree.set(tid, (degree.get(tid) || 0) + 1);
    });

    const nodeRadius = (n: Executive) => {
      const deg = degree.get(n.id) || 0;
      return Math.max(5, Math.min(20, 5 + deg * 0.6));
    };

    // ── simulation ────────────────────────────────────────
    const nodes: Executive[] = visibleNodes.map((n) => ({ ...n }));
    const links = visibleLinks.map((l) => ({
      ...l,
      source: typeof l.source === "object" ? l.source.id : l.source,
      target: typeof l.target === "object" ? l.target.id : l.target,
    }));

    const simulation = d3
      .forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d: d3.SimulationNodeDatum) => (d as Executive).id)
          .distance(80)
          .strength((l: d3.SimulationLinkDatum<d3.SimulationNodeDatum>) =>
            ((l as unknown as Relationship).strength || 0.5) * 0.3
          )
      )
      .force("charge", d3.forceManyBody().strength(-120))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d) => nodeRadius(d as Executive) + 2));

    // ── zoom ──────────────────────────────────────────────
    const g = svg.append("g");
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 8])
        .on("zoom", (event) => g.attr("transform", event.transform))
    );

    // ── links ─────────────────────────────────────────────
    const linkSel = g
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (l) => REL_COLOR[(l as unknown as Relationship).type] || "#ccc")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.5);

    // ── nodes ─────────────────────────────────────────────
    const nodeSel = g
      .append("g")
      .attr("class", "nodes")
      .selectAll<SVGCircleElement, Executive>("circle")
      .data(nodes)
      .join("circle")
      .attr("r", nodeRadius)
      .attr("fill", (n) => REGION_COLOR[n.region] || "#888")
      .attr("stroke", (n) => (n.id === selectedId ? "#fff" : "transparent"))
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .call(
        d3
          .drag<SVGCircleElement, Executive>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // hover highlight
    nodeSel
      .on("mouseover", (_event, hovered) => {
        const neighborIds = new Set<number>();
        links.forEach((l) => {
          const sid = typeof l.source === "object" ? (l.source as Executive).id : (l.source as number);
          const tid = typeof l.target === "object" ? (l.target as Executive).id : (l.target as number);
          if (sid === hovered.id) neighborIds.add(tid);
          if (tid === hovered.id) neighborIds.add(sid);
        });
        nodeSel.attr("opacity", (n) =>
          n.id === hovered.id || neighborIds.has(n.id) ? 1 : 0.15
        );
        linkSel.attr("stroke-opacity", (l) => {
          const sid = typeof l.source === "object" ? (l.source as Executive).id : (l.source as number);
          const tid = typeof l.target === "object" ? (l.target as Executive).id : (l.target as number);
          return sid === hovered.id || tid === hovered.id ? 0.9 : 0.05;
        });
        labelSel.attr("opacity", (n) =>
          n.id === hovered.id || neighborIds.has(n.id) ? 1 : 0
        );
      })
      .on("mouseout", () => {
        nodeSel.attr("opacity", 1);
        linkSel.attr("stroke-opacity", 0.5);
        labelSel.attr("opacity", (n) => (degree.get(n.id) || 0) >= 5 ? 0.8 : 0);
      })
      .on("click", (_event, n) => {
        onSelectNode(n);
      });

    // labels (only for high-degree nodes by default)
    const labelSel = g
      .append("g")
      .attr("class", "labels")
      .selectAll<SVGTextElement, Executive>("text")
      .data(nodes)
      .join("text")
      .text((n) => n.name)
      .attr("font-size", 10)
      .attr("fill", "#e2e8f0")
      .attr("pointer-events", "none")
      .attr("opacity", (n) => (degree.get(n.id) || 0) >= 5 ? 0.8 : 0);

    // tooltip
    const tooltip = d3
      .select(containerRef.current)
      .append("div")
      .attr("class", "graph-tooltip")
      .style("position", "absolute")
      .style("background", "rgba(15,23,42,0.92)")
      .style("color", "#e2e8f0")
      .style("padding", "8px 12px")
      .style("border-radius", "8px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("display", "none")
      .style("max-width", "200px")
      .style("z-index", "10");

    nodeSel
      .on("mousemove.tip", (event, n) => {
        tooltip
          .style("display", "block")
          .style("left", event.offsetX + 14 + "px")
          .style("top", event.offsetY - 10 + "px")
          .html(`<b>${n.name}</b><br/>${n.title}<br/><span style="opacity:.7">${n.company}</span>`);
      })
      .on("mouseleave.tip", () => tooltip.style("display", "none"));

    // ── tick ──────────────────────────────────────────────
    simulation.on("tick", () => {
      linkSel
        .attr("x1", (l) => (l.source as unknown as Executive).x ?? 0)
        .attr("y1", (l) => (l.source as unknown as Executive).y ?? 0)
        .attr("x2", (l) => (l.target as unknown as Executive).x ?? 0)
        .attr("y2", (l) => (l.target as unknown as Executive).y ?? 0);

      nodeSel
        .attr("cx", (n) => n.x ?? 0)
        .attr("cy", (n) => n.y ?? 0);

      labelSel
        .attr("x", (n) => (n.x ?? 0) + nodeRadius(n) + 2)
        .attr("y", (n) => (n.y ?? 0) + 4);
    });

    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [data, selectedId, onSelectNode, filterRegion, filterRelType, searchName]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    draw().then((fn) => { cleanup = fn; });
    return () => cleanup?.();
  }, [draw]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-900">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
