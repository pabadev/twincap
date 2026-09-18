// Alert component contract tests (UX-10 S5, DEC-DS-06).
// renderToStaticMarkup style, mirroring fields-a11y.test.tsx.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Alert } from "../alert";

describe("Alert", () => {
  it("danger renders banner classes, AlertCircle icon and role=alert", () => {
    const html = renderToStaticMarkup(<Alert variant="danger">Update</Alert>);

    expect(html).toContain('role="alert"');
    expect(html).toContain("bg-danger/10");
    expect(html).toContain("text-danger");
    expect(html).toContain("rounded-md");
    // AlertCircle icon renders (lucide svg).
    expect(html).toContain("svg");
  });

  it("info renders without role and honors the info class contract", () => {
    const html = renderToStaticMarkup(<Alert variant="info">Soon</Alert>);

    expect(html).not.toContain('role="alert"');
    expect(html).toContain("bg-info/10");
    expect(html).toContain("text-info");
    expect(html).toContain("dark:text-info-soft");
    expect(html).toContain("dark:bg-info/15");
  });

  it("title renders as a bold lead paragraph before the message body", () => {
    const html = renderToStaticMarkup(
      <Alert variant="info" title="Verify email">
        Check inbox
      </Alert>,
    );

    expect(html).toContain("font-medium");
    expect(html).toContain("Verify email");
    expect(html).toContain("Check inbox");
  });

  it("action slot renders on the right side", () => {
    const html = renderToStaticMarkup(
      <Alert variant="info" title="T" action={<button type="button">Resend</button>}>
        Body
      </Alert>,
    );

    expect(html).toContain("Resend");
    expect(html).toContain("justify-between");
  });

  it("copy flows through children verbatim (no i18n inside the component)", () => {
    const html = renderToStaticMarkup(<Alert variant="danger">ERR_SOMETHING</Alert>);

    expect(html).toContain("ERR_SOMETHING");
  });
});
