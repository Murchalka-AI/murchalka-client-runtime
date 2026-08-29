import type { JsonSchema } from "./JsonSchema.js";

/** Validates extension values against the closed JSON Schema subset supported by clients. */
export class JsonSchemaValidator {
  /** Throws when a value does not satisfy the supplied bounded schema. */
  public validate(value: unknown, schema: JsonSchema, label = "value"): void {
    this.visit(value, schema, label, 0);
  }

  private visit(value: unknown, schema: JsonSchema, path: string, depth: number): void {
    if (depth > 32) throw new Error(`${path} schema exceeds the validation depth limit.`);
    if (Array.isArray(schema.oneOf)) {
      const matches = schema.oneOf.filter(candidate => this.matches(value, candidate, path, depth + 1)).length;
      if (matches !== 1) throw new Error(`${path} must match exactly one schema branch.`);
    }
    if ("const" in schema && !this.equal(value, schema.const)) throw new Error(`${path} does not match its constant value.`);
    if (Array.isArray(schema.enum) && !schema.enum.some(candidate => this.equal(value, candidate))) throw new Error(`${path} is outside its allowed values.`);
    if (typeof schema.type === "string" && !this.hasType(value, schema.type)) throw new Error(`${path} must be ${schema.type}.`);
    if (typeof value === "string") this.validateString(value, schema, path);
    if (typeof value === "number") this.validateNumber(value, schema, path);
    if (Array.isArray(value)) this.validateArray(value, schema, path, depth);
    if (this.isRecord(value)) this.validateObject(value, schema, path, depth);
  }

  private validateString(value: string, schema: JsonSchema, path: string): void {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) throw new Error(`${path} is too short.`);
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) throw new Error(`${path} is too long.`);
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern, "u").test(value)) throw new Error(`${path} has an invalid format.`);
  }

  private validateNumber(value: number, schema: JsonSchema, path: string): void {
    if (!Number.isFinite(value)) throw new Error(`${path} must be finite.`);
    if (schema.type === "integer" && !Number.isSafeInteger(value)) throw new Error(`${path} must be a safe integer.`);
    if (typeof schema.minimum === "number" && value < schema.minimum) throw new Error(`${path} is below its minimum.`);
    if (typeof schema.maximum === "number" && value > schema.maximum) throw new Error(`${path} exceeds its maximum.`);
  }

  private validateArray(value: readonly unknown[], schema: JsonSchema, path: string, depth: number): void {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) throw new Error(`${path} contains too few items.`);
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) throw new Error(`${path} contains too many items.`);
    if (this.isRecord(schema.items)) value.forEach((item, index) => this.visit(item, schema.items as JsonSchema, `${path}[${index}]`, depth + 1));
  }

  private validateObject(value: Readonly<Record<string, unknown>>, schema: JsonSchema, path: string, depth: number): void {
    const properties = this.isRecord(schema.properties) ? schema.properties : {};
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) if (typeof key === "string" && !(key in value)) throw new Error(`${path}.${key} is required.`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!(key in properties)) throw new Error(`${path}.${key} is not allowed.`);
    }
    for (const [key, propertySchema] of Object.entries(properties)) {
      if (key in value && this.isRecord(propertySchema)) this.visit(value[key], propertySchema, `${path}.${key}`, depth + 1);
    }
  }

  private matches(value: unknown, candidate: unknown, path: string, depth: number): boolean {
    if (!this.isRecord(candidate)) return false;
    try { this.visit(value, candidate, path, depth); return true; } catch { return false; }
  }

  private hasType(value: unknown, type: string): boolean {
    if (type === "null") return value === null;
    if (type === "array") return Array.isArray(value);
    if (type === "object") return this.isRecord(value);
    if (type === "integer") return typeof value === "number" && Number.isSafeInteger(value);
    return typeof value === type;
  }

  private equal(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  private isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
}
