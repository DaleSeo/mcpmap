import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main>
      <h1>mcpmap</h1>
      <p>A visual map of the Model Context Protocol spec.</p>
      <p>
        Interactive type explorer, message flows, and version diffs — generated from the official
        MCP schema so they can&rsquo;t drift.
      </p>
      <p>
        <Link to="/explore">Open the type explorer →</Link>
      </p>
    </main>
  );
}
