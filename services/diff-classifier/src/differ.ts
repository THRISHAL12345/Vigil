import { SchemaDelta, SchemaDeltaKind, SchemaLocation } from "@vigil/schemas";

export function computeDeltas(fromTree: any, toTree: any): SchemaDelta[] {
  const deltas: SchemaDelta[] = [];

  const fromPaths = fromTree?.paths || {};
  const toPaths = toTree?.paths || {};

  // Check for removed and modified endpoints
  for (const [pathUrl, fromPathObj] of Object.entries(fromPaths)) {
    if (!toPaths[pathUrl]) {
      // Entire path removed
      for (const method of Object.keys(fromPathObj as any)) {
        deltas.push({
          kind: "endpoint_removed",
          location: "path",
          path: `${method.toUpperCase()} ${pathUrl}`
        });
      }
      continue;
    }

    const toPathObj: any = toPaths[pathUrl];
    
    for (const [method, fromOp] of Object.entries(fromPathObj as any)) {
      if (!toPathObj[method]) {
        deltas.push({
          kind: "endpoint_removed",
          location: "path",
          path: `${method.toUpperCase()} ${pathUrl}`
        });
        continue;
      }

      const toOp: any = toPathObj[method];
      const operationPath = `${method.toUpperCase()} ${pathUrl}`;

      // Check request schema fields
      const fromReqSchema = (fromOp as any)?.requestBody?.content?.["application/json"]?.schema;
      const toReqSchema = toOp?.requestBody?.content?.["application/json"]?.schema;

      if (fromReqSchema && toReqSchema) {
        checkSchemaDifferences(operationPath, "request_schema", fromReqSchema, toReqSchema, deltas);
      }

      // Check response schema fields (assume 200 OK for simplicity in v1)
      const fromResSchema = (fromOp as any)?.responses?.["200"]?.content?.["application/json"]?.schema;
      const toResSchema = toOp?.responses?.["200"]?.content?.["application/json"]?.schema;

      if (fromResSchema && toResSchema) {
        checkSchemaDifferences(operationPath, "response_schema", fromResSchema, toResSchema, deltas);
      }
    }
  }

  // Check for added endpoints
  for (const [pathUrl, toPathObj] of Object.entries(toPaths)) {
    const fromPathObj: any = fromPaths[pathUrl];
    
    for (const method of Object.keys(toPathObj as any)) {
      if (!fromPathObj || !fromPathObj[method]) {
        deltas.push({
          kind: "endpoint_added",
          location: "path",
          path: `${method.toUpperCase()} ${pathUrl}`
        });
      }
    }
  }

  return deltas;
}

function checkSchemaDifferences(
  operationPath: string, 
  location: SchemaLocation, 
  fromSchema: any, 
  toSchema: any, 
  deltas: SchemaDelta[]
) {
  const fromProps = fromSchema?.properties || {};
  const toProps = toSchema?.properties || {};
  const fromRequired = fromSchema?.required || [];
  const toRequired = toSchema?.required || [];

  for (const [propName, fromPropDef] of Object.entries(fromProps)) {
    const toPropDef = toProps[propName];
    const path = `${operationPath}.${propName}`;

    if (!toPropDef) {
      deltas.push({
        kind: "field_removed",
        location,
        path,
        fieldName: propName
      });
      continue;
    }

    // Check if required status changed
    const wasRequired = fromRequired.includes(propName);
    const isRequired = toRequired.includes(propName);

    if (wasRequired !== isRequired) {
      deltas.push({
        kind: "field_modified",
        location,
        path,
        fieldName: propName,
        before: { required: wasRequired },
        after: { required: isRequired }
      });
    }
  }

  for (const [propName, toPropDef] of Object.entries(toProps)) {
    if (!fromProps[propName]) {
      const isRequired = toRequired.includes(propName);
      deltas.push({
        kind: "field_added",
        location,
        path: `${operationPath}.${propName}`,
        fieldName: propName,
        after: { required: isRequired }
      });
    }
  }
}
