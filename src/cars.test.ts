import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FLEET, R2_PREFIX, carUrl, findCar, pendingUpload } from "./index.js";

describe("@khr3/cars catalog", () => {
  it("has unique ids and keys", () => {
    assert.equal(new Set(FLEET.map((c) => c.id)).size, FLEET.length);
    assert.equal(new Set(FLEET.map((c) => c.r2Key)).size, FLEET.length);
  });

  it("files each kind under its own R2 prefix", () => {
    for (const c of FLEET) assert.ok(c.r2Key.startsWith(`${R2_PREFIX[c.kind]}/`), c.id);
    assert.equal(findCar("crotch_rocket").r2Key, "bikes/crotch_rocket.glb");
    assert.equal(findCar("starfox_rocket").r2Key, "craft/starfox_rocket.glb");
  });

  it("matches the live R2 manifest for what is already uploaded", () => {
    assert.equal(findCar("lexus_is300").r2Key, "cars/lexus_is300.glb");
    assert.equal(findCar("kolmogorov_hatchback").r2Key, "cars/kolmogorov_hatchback.glb");
  });

  it("builds absolute URLs and rejects bad input", () => {
    assert.equal(carUrl("https://khr3.optimuspi.workers.dev/", "lexus_is300"), "https://khr3.optimuspi.workers.dev/assets/cars/lexus_is300.glb");
    assert.throws(() => carUrl("/relative", "lexus_is300"), RangeError);
    assert.throws(() => findCar("delorean"), RangeError);
  });

  it("lists the five fleet vehicles that are not on R2 yet", () => {
    assert.deepEqual(pendingUpload().map((c) => c.id), [
      "nissan_silvia_s15", "nissan_skyline_r34", "toyota_supra_a80", "crotch_rocket", "starfox_rocket",
    ]);
  });
});
