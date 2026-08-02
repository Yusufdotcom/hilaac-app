import { isAuthorizedCronRequest } from "../lib/jobs/verify-cron.ts";

function fakeReq(auth) {
  return {
    headers: {
      get(name) {
        return name.toLowerCase() === "authorization" ? auth : null;
      },
    },
  };
}

let passed = 0;
function check(name, cond) {
  if (!cond) {
    console.error("FAIL", name);
    process.exitCode = 1;
    return;
  }
  console.log("PASS", name);
  passed += 1;
}

const prev = process.env.CRON_SECRET;

process.env.CRON_SECRET = "";
check("empty secret rejects", !isAuthorizedCronRequest(fakeReq("Bearer anything")));

delete process.env.CRON_SECRET;
check("missing secret rejects", !isAuthorizedCronRequest(fakeReq("Bearer x")));

process.env.CRON_SECRET = "test-cron-secret";
check("wrong bearer rejects", !isAuthorizedCronRequest(fakeReq("Bearer wrong")));
check("missing header rejects", !isAuthorizedCronRequest(fakeReq(null)));
check("correct bearer accepts", isAuthorizedCronRequest(fakeReq("Bearer test-cron-secret")));

if (prev === undefined) delete process.env.CRON_SECRET;
else process.env.CRON_SECRET = prev;

console.log(`C4 checks: ${passed} passed`);
