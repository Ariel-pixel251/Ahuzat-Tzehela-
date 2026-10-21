import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * SQL must never be built from strings: user input goes in bind parameters ($1, $2…) only.
 * This rule fails on db.query(...) / .exec(...) / .unsafe(...) whose SQL text is a template with
 * ${…} or a "+" concatenation. (Use a view or write the SQL out in full instead.)
 */
const noSqlInterpolation = {
  meta: {
    type: "problem",
    docs: { description: "Disallow SQL text built with interpolation or concatenation" },
    messages: {
      interpolated: "SQL text must be a constant: put values in $1, $2… parameters, never ${…} or + in the query.",
    },
    schema: [],
  },
  create(context) {
    const built = (node) =>
      node &&
      ((node.type === "TemplateLiteral" && node.expressions.length > 0) ||
        (node.type === "BinaryExpression" && node.operator === "+") ||
        (node.type === "CallExpression" && node.callee.type === "MemberExpression" && node.callee.property.name === "concat"));
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression" || callee.property.type !== "Identifier") return;
        if (!["query", "exec", "unsafe"].includes(callee.property.name)) return;
        if (built(node.arguments[0])) context.report({ node: node.arguments[0], messageId: "interpolated" });
      },
      // tagged templates (sql`…` in drivers that have them) are parameterised by the driver
      TaggedTemplateExpression() {},
    };
  },
};

const config = [
  ...nextVitals,
  ...nextTs,
  {
    plugins: { local: { rules: { "no-sql-interpolation": noSqlInterpolation } } },
    rules: {
      "local/no-sql-interpolation": "error",
      "react/no-danger": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
    },
  },
  { ignores: [".next/**", ".data/**", "test-results/**", "playwright-report/**", "next-env.d.ts"] },
];

export default config;
