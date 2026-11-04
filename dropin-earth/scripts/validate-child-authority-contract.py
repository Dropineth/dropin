"""Validate exported JSON Schemas and fixture vectors; requires jsonschema 4.x."""
import copy
import json
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker

root = Path('contracts/ahin-signer-profile/v1')
doc = json.loads((root / 'openapi.json').read_text())
fixture = json.loads((root / 'fixtures.json').read_text())
assert doc['openapi'] == '3.1.0'
assert set(doc['paths']) == {'/current'}
schemas = doc['components']['schemas']
for schema in schemas.values():
    Draft202012Validator.check_schema(schema)
request = Draft202012Validator(schemas['CurrentAuthorityRequest'], format_checker=FormatChecker())
response = Draft202012Validator(schemas['SignedSnapshot'], format_checker=FormatChecker())
request.validate(fixture['request'])
response.validate(fixture['response'])
Draft202012Validator(schemas['SignedRestoreCheckpoint']).validate(fixture['restoreVector']['signed'])
Draft202012Validator(schemas['ResumeRequest']).validate(fixture['resumeRequest'])
for mutation in fixture['schemaNegativeMutations']:
    value = copy.deepcopy(fixture['response'])
    target = value
    for key in mutation['path'][:-1]:
        target = target[key]
    target[mutation['path'][-1]] = mutation['value']
    assert list(response.iter_errors(value)), mutation

def check_refs(node):
    if isinstance(node, dict):
        if '$ref' in node:
            assert node['$ref'].startswith('#/components/schemas/')
            assert node['$ref'].split('/')[-1] in schemas
        for value in node.values():
            check_refs(value)
    elif isinstance(node, list):
        for value in node:
            check_refs(value)
check_refs(doc)
print(f'{len(schemas)} schemas valid; 4 positive and 5 negative schema fixtures passed; references resolved')
