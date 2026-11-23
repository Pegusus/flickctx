const assert = require("assert");
const { assertPublicHttpUrl, isPrivateHostname, isPrivateIpv4 } = require("./net");

assert.strictEqual(isPrivateIpv4("127.0.0.1"), true);
assert.strictEqual(isPrivateIpv4("10.0.0.5"), true);
assert.strictEqual(isPrivateIpv4("192.168.1.1"), true);
assert.strictEqual(isPrivateIpv4("169.254.169.254"), true);
assert.strictEqual(isPrivateIpv4("8.8.8.8"), false);

assert.strictEqual(isPrivateHostname("localhost"), true);
assert.strictEqual(isPrivateHostname("docs.example.com"), false);

assert.strictEqual(assertPublicHttpUrl("https://docs.aws.amazon.com").ok, true);
assert.strictEqual(assertPublicHttpUrl("file:///etc/passwd").ok, false);
assert.strictEqual(assertPublicHttpUrl("http://127.0.0.1/").ok, false);
assert.strictEqual(assertPublicHttpUrl("http://169.254.169.254/latest").ok, false);

console.log("net.test.js ok");
