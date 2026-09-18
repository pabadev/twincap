"use strict";
// UX-12 U3 banner migration patches (one-shot script).
const fs = require("fs");

function patch(path, pairs) {
  let s = fs.readFileSync(path, "utf8");
  for (const [a, b] of pairs) {
    if (!s.includes(a)) {
      console.error("MISS in " + path + " :: " + JSON.stringify(a.slice(0, 90)));
      process.exit(1);
    }
    s = s.replace(a, b);
  }
  fs.writeFileSync(path, s);
  console.log("ok " + path);
}

const DANGER_BLOCK_AUTH = [
  "          <div className=\"rounded-md bg-danger/10 p-3 text-sm text-danger\">",
  "            {tError(state.error.replace(/^error\\./, ''))}",
  "          </div>",
].join("\n");

patch("src/app/(auth)/auth-form.tsx", [
  [
    "import { Button } from '../../components/ui/button';",
    "import { Button } from '../../components/ui/button';\nimport { Alert } from '../../components/ui/alert';",
  ],
  [
    DANGER_BLOCK_AUTH,
    '          <Alert variant="danger">{tError(state.error.replace(/^error\\./, \'\'))}</Alert>',
  ],
]);

patch("src/app/(auth)/forgot-password/forgot-password-form.tsx", [
  [
    [
      "        {state?.success && (",
      "          <div className=\"rounded-md bg-success/10 p-3 text-sm text-success\">",
      "            {t('resetLinkSent')}",
      "          </div>",
      "        )}",
      "        {state?.error && (",
      "          <div className=\"rounded-md bg-danger/10 p-3 text-sm text-danger\">",
      "            {translateError(state.error, t('errorGeneric'))}",
      "          </div>",
      "        )}",
    ].join("\n"),
    [
      "        {state?.success && (",
      "          <Alert variant=\"success\">{t('resetLinkSent')}</Alert>",
      "        )}",
      "        {state?.error && (",
      "          <Alert variant=\"danger\">{translateError(state.error, t('errorGeneric'))}</Alert>",
      "        )}",
    ].join("\n"),
  ],
  [
    "import { Input } from '../../../components/ui/input';",
    "import { Input } from '../../../components/ui/input';\nimport { Alert } from '../../../components/ui/alert';",
  ],
]);

patch("src/app/(auth)/reset-password/reset-password-form.tsx", [
  [
    [
      "        {state?.success && (",
      "          <div className=\"rounded-md bg-success/10 p-3 text-sm text-success\">",
      "            {t('passwordReset')}",
      "          </div>",
      "        )}",
      "        {state?.error && (",
      "          <div className=\"rounded-md bg-danger/10 p-3 text-sm text-danger\">",
      "            {translateError(state.error, t('invalidResetToken'))}",
      "          </div>",
      "        )}",
    ].join("\n"),
    [
      "        {state?.success && (",
      "          <Alert variant=\"success\">{t('passwordReset')}</Alert>",
      "        )}",
      "        {state?.error && (",
      "          <Alert variant=\"danger\">{translateError(state.error, t('invalidResetToken'))}</Alert>",
      "        )}",
    ].join("\n"),
  ],
  [
    "import { PasswordInput } from '../../../components/ui/password-input';",
    "import { PasswordInput } from '../../../components/ui/password-input';\nimport { Alert } from '../../../components/ui/alert';",
  ],
]);

patch("src/components/feedback/feedback-widget.tsx", [
  [
    [
      "          {state.error && (",
      "            <div className=\"rounded-md bg-danger/10 px-3 py-2 text-sm text-danger\">",
      "              {state.error === \"error.validation\"",
      "                ? t(\"errorValidation\")",
      "                : state.error === \"error.unauthorized\"",
      "                  ? translateError(state.error)",
      "                  : t(\"errorFailed\")}",
      "            </div>",
      "          )}",
    ].join("\n"),
    [
      "          {state.error && (",
      "            <Alert variant=\"danger\">",
      "              {state.error === \"error.validation\"",
      "                ? t(\"errorValidation\")",
      "                : state.error === \"error.unauthorized\"",
      "                  ? translateError(state.error)",
      "                  : t(\"errorFailed\")}",
      "            </Alert>",
      "          )}",
    ].join("\n"),
  ],
  [
    "import { Button } from \"@/components/ui/button\";",
    "import { Button } from \"@/components/ui/button\";\nimport { Alert } from \"@/components/ui/alert\";",
  ],
]);
