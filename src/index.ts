import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { dateStamp, loadPluginConfig, parseModel } from "./config.ts";
import type { LlmClient } from "./llm.ts";
import { runInsights } from "./orchestrator.ts";
import type { InsightsConfig, InsightsModel } from "./types.ts";

export const InsightsPlugin: Plugin = async (ctx) => {
  const initPaths = ((await ctx.client.path.get()) as { data: { config: string; state: string } })
    .data;
  const pluginConfig = loadPluginConfig(initPaths.config);

  return {
    async config(cfg) {
      cfg.agent ??= {};
      cfg.agent["insights-analyzer"] = {
        description:
          "Low-temperature agent for structured JSON analysis. Used by the insights plugin.",
        temperature: 0,
        tools: {},
        disable: false,
      };

      cfg.command ??= {};
      cfg.command.insights = {
        description: "Generate a usage insights report for your OpenCode sessions.",
        template:
          "Call the insights tool with these arguments: $ARGUMENTS\n\nWhen it finishes, show the user the report path and the at-a-glance summary verbatim.",
      };
    },

    tool: {
      insights: tool({
        description:
          "Analyze OpenCode session history and generate an HTML insights report. Args: days (default 30), force (bypass cache), model (provider/model string), output (path), project (only current project).",
        args: {
          days: tool.schema.number().int().min(1).max(365).default(30).optional(),
          force: tool.schema.boolean().default(false).optional(),
          model: tool.schema.string().optional(),
          output: tool.schema.string().optional(),
          project: tool.schema.boolean().default(false).optional(),
        },
        async execute(args, toolCtx) {
          // model precedence: --model arg > insights.json config
          const model: InsightsModel = parseModel(args.model ?? pluginConfig.model);

          const stateDir = initPaths.state;

          const config: InsightsConfig = {
            model,
            days: args.days ?? pluginConfig.days,
            force: args.force ?? false,
            concurrency: pluginConfig.concurrency,
            maxSessions: pluginConfig.maxSessions,
            projectOnly: args.project ?? false,
            output: args.output ?? `${stateDir}/insights/report-${dateStamp()}.html`,
          };

          toolCtx.metadata({ title: `Generating insights (last ${config.days} days)...` });

          const result = await runInsights(
            {
              client: ctx.client as unknown as LlmClient,
              stateDir,
              projectDir: toolCtx.directory,
            },
            config,
            (phase, done, total) => {
              if (phase === "facets" && done !== undefined && total !== undefined) {
                toolCtx.metadata({ title: `Extracting session facets (${done}/${total})...` });
              } else if (phase === "aggregates") {
                toolCtx.metadata({ title: "Running aggregate analysis..." });
              } else if (phase === "at_a_glance") {
                toolCtx.metadata({ title: "Generating at-a-glance summary..." });
              }
            },
          );

          // Open the report in the default browser (non-fatal — fails silently in CI/headless)
          const opener =
            process.platform === "darwin"
              ? "open"
              : process.platform === "win32"
                ? "start"
                : "xdg-open";
          ctx.$`${opener} ${result.reportPath}`.catch(() => {});

          await ctx.client.tui.showToast({
            body: { message: `Insights report ready: ${result.reportPath}`, variant: "success" },
          });

          const glance = result.atAGlance as Record<string, string | undefined>;
          return {
            title: "Insights Report Generated",
            output: [
              `Report: ${result.reportPath}`,
              `JSON: ${result.jsonPath}`,
              `Sessions analyzed: ${result.analyzedCount}/${result.sessionCount}`,
              `Total cost analyzed: $${result.totalCost.toFixed(4)}`,
              "",
              "## At a Glance",
              "",
              glance.whats_working ? `**What's Working:** ${glance.whats_working}` : "",
              glance.whats_hindering ? `**What's Hindering:** ${glance.whats_hindering}` : "",
              glance.quick_wins ? `**Quick Wins:** ${glance.quick_wins}` : "",
              glance.ambitious_workflows
                ? `**Ambitious Workflows:** ${glance.ambitious_workflows}`
                : "",
            ]
              .filter(Boolean)
              .join("\n"),
          };
        },
      }),
    },
  };
};

export default InsightsPlugin;
