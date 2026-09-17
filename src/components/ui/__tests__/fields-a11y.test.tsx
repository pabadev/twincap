import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Input } from "../input";
import { PasswordInput } from "../password-input";
import { Select } from "../select";

// UX-9 Slice B, R-6 (H-13): required fields expose the NATIVE `required`
// attribute (assistive tech reads it as aria-required) and the manual `*`
// is removed from labels. Scenarios S6.3.

const options = [
  { value: "a", label: "Option A" },
  { value: "b", label: "Option B" },
];

describe("Field required semantics — no manual asterisk (S6.3)", () => {
  it("Select with required renders the native attribute and a plain label", () => {
    const html = renderToStaticMarkup(
      createElement(Select, { id: "clientId", label: "Client", required: true, options }),
    );
    expect(html).toContain('for="clientId"');
    expect(html).not.toContain("*");
    expect(html).toMatch(/<select[^>]*required=""/);
  });

  it("Input with required renders the native attribute and a plain label", () => {
    const html = renderToStaticMarkup(
      createElement(Input, { id: "amount", label: "Amount", required: true }),
    );
    expect(html).toContain('for="amount"');
    expect(html).not.toContain("*");
    expect(html).toMatch(/<input[^>]*required=""/);
  });

  it("PasswordInput with required renders the native attribute and a plain label", () => {
    const html = renderToStaticMarkup(
      createElement(PasswordInput, { id: "password", label: "Password", required: true }),
    );
    expect(html).toContain('for="password"');
    expect(html).not.toContain("*");
    expect(html).toMatch(/<input[^>]*required=""/);
  });

  it("omits the required attribute when the prop is not set", () => {
    const selectHtml = renderToStaticMarkup(
      createElement(Select, { id: "clientId", label: "Client", options }),
    );
    const inputHtml = renderToStaticMarkup(createElement(Input, { id: "amount", label: "Amount" }));
    const passwordHtml = renderToStaticMarkup(
      createElement(PasswordInput, { id: "password", label: "Password" }),
    );
    expect(selectHtml).not.toMatch(/<select[^>]*required/);
    expect(inputHtml).not.toMatch(/<input[^>]*required/);
    expect(passwordHtml).not.toMatch(/<input[^>]*required/);
    expect(selectHtml).not.toContain("*");
    expect(inputHtml).not.toContain("*");
    expect(passwordHtml).not.toContain("*");
  });
});

describe("Field error association via aria-describedby (S7.1/S7.2)", () => {
  it("Select with error references the message id and sets aria-invalid (S7.1)", () => {
    const html = renderToStaticMarkup(
      createElement(Select, {
        id: "clientId",
        label: "Client",
        error: "Client is required",
        options,
      }),
    );
    expect(html).toContain('aria-describedby="clientId-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('<p id="clientId-error"');
    expect(html).toContain("Client is required");
  });

  it("Input with error references the message id and sets aria-invalid (S7.1)", () => {
    const html = renderToStaticMarkup(
      createElement(Input, { id: "amount", label: "Amount", error: "Amount is required" }),
    );
    expect(html).toContain('aria-describedby="amount-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('<p id="amount-error"');
    expect(html).toContain("Amount is required");
  });

  it("PasswordInput with error references the message id and sets aria-invalid (S7.1)", () => {
    const html = renderToStaticMarkup(
      createElement(PasswordInput, {
        id: "password",
        label: "Password",
        error: "Password is required",
      }),
    );
    expect(html).toContain('aria-describedby="password-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('<p id="password-error"');
    expect(html).toContain("Password is required");
  });

  it("omits aria-describedby and aria-invalid when there is no error (S7.2)", () => {
    const selectHtml = renderToStaticMarkup(
      createElement(Select, { id: "clientId", label: "Client", options }),
    );
    const inputHtml = renderToStaticMarkup(createElement(Input, { id: "amount", label: "Amount" }));
    const passwordHtml = renderToStaticMarkup(
      createElement(PasswordInput, { id: "password", label: "Password" }),
    );
    expect(selectHtml).not.toContain("aria-describedby");
    expect(selectHtml).not.toContain("aria-invalid");
    expect(inputHtml).not.toContain("aria-describedby");
    expect(inputHtml).not.toContain("aria-invalid");
    expect(passwordHtml).not.toContain("aria-describedby");
    expect(passwordHtml).not.toContain("aria-invalid");
  });

  it("passes an explicit consumer aria-invalid through when there is no error", () => {
    const html = renderToStaticMarkup(
      createElement(Input, { id: "initial", label: "Initial", "aria-invalid": true }),
    );
    expect(html).toContain('aria-invalid="true"');
  });
});
