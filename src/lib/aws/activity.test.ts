import { CloudTrailClient, LookupEventsCommand } from '@aws-sdk/client-cloudtrail'
import { mockClient } from 'aws-sdk-client-mock'
import { beforeEach, describe, expect, it } from 'vitest'
import { lookupActivity, secretNameFromId, toActivityEvent } from './activity'

const ROLE = 'arn:aws:iam::123456789012:role/secrets-console'
const PLANTED = 'planted-secret-value-should-never-appear'

const event = (over: Record<string, unknown>, name = 'GetSecretValue') => ({
  EventId: 'e1',
  EventName: name,
  EventTime: new Date('2026-09-25T01:12:08Z'),
  CloudTrailEvent: JSON.stringify({
    eventName: name,
    sourceIPAddress: '203.0.113.24',
    requestID: 'req-1',
    userIdentity: {
      type: 'AssumedRole',
      arn: 'arn:aws:sts::123456789012:assumed-role/secrets-console/sc-ca862fd5',
      sessionContext: {
        sourceIdentity: 'thi@example.com',
        sessionIssuer: { arn: ROLE },
      },
    },
    requestParameters: {
      secretId: 'arn:aws:secretsmanager:ap-southeast-1:123456789012:secret:sc-demo/app/db-AbC123',
      versionId: 'v1',
      secretString: PLANTED,
    },
    responseElements: { secretString: PLANTED },
    ...over,
  }),
})

describe('toActivityEvent', () => {
  it('names the real person, detects the app, and strips the ARN suffix', () => {
    const a = toActivityEvent(event({}), ROLE)!
    expect(a).toMatchObject({
      label: 'Reveal',
      kind: 'reveal',
      who: 'thi@example.com',
      viaApp: true,
      secretName: 'sc-demo/app/db',
      versionId: 'v1',
      sourceIp: '203.0.113.24',
      requestId: 'req-1',
      roleSession: 'sc-ca862fd5',
    })
  })

  it('never carries request or response bodies', () => {
    expect(JSON.stringify(toActivityEvent(event({}), ROLE))).not.toContain(PLANTED)
  })

  it('marks console/CLI calls and failed calls', () => {
    const a = toActivityEvent(
      event(
        {
          userIdentity: {
            type: 'IAMUser',
            arn: 'arn:aws:iam::123456789012:user/ddbt',
            userName: 'ddbt',
          },
          errorCode: 'AccessDenied',
          requestParameters: { name: 'sc-demo/config' },
        },
        'CreateSecret',
      ),
      ROLE,
    )!
    expect(a).toMatchObject({
      who: 'ddbt',
      viaApp: false,
      kind: 'change',
      label: 'Create',
      errorCode: 'AccessDenied',
      secretName: 'sc-demo/config',
    })
  })

  it('treats unknown events as reads and survives malformed JSON', () => {
    const a = toActivityEvent(
      {
        EventName: 'ListSecrets',
        EventTime: new Date('2026-09-25T00:00:00Z'),
        CloudTrailEvent: '{not json',
        Username: 'x',
      },
      ROLE,
    )!
    expect(a).toMatchObject({ kind: 'read', label: 'ListSecrets', who: 'x' })
  })

  it('parses secret names from ARNs', () => {
    expect(
      secretNameFromId('arn:aws:secretsmanager:us-east-1:123456789012:secret:a/b-c-XyZ123'),
    ).toBe('a/b-c')
    expect(secretNameFromId('plain/name')).toBe('plain/name')
  })
})

describe('lookupActivity', () => {
  const ct = mockClient(CloudTrailClient)
  beforeEach(() => ct.reset())

  it('stops paging once enough events match, and repeats the same window each call', async () => {
    ct.on(LookupEventsCommand).resolves({ Events: [event({})], NextToken: 'more' })
    const client = new CloudTrailClient({ region: 'ap-southeast-1' })
    const start = new Date(1000)
    const end = new Date(2000)
    const out = await lookupActivity(client, ROLE, { start, end, minMatches: 1 })
    expect(out.events).toHaveLength(1)
    const calls = ct.commandCalls(LookupEventsCommand)
    expect(calls).toHaveLength(1)
    expect(calls[0].args[0].input).toMatchObject({ StartTime: start, EndTime: end })
  })

  it('skips events with an unusable time instead of failing the page', () => {
    expect(
      toActivityEvent(
        { EventName: 'GetSecretValue', CloudTrailEvent: '{"eventTime":"nope"}' },
        ROLE,
      ),
    ).toBeNull()
  })

  it('queries only Secrets Manager events and caps pages', async () => {
    ct.on(LookupEventsCommand).resolves({ Events: [event({})], NextToken: 'more' })
    const client = new CloudTrailClient({ region: 'ap-southeast-1' })
    const out = await lookupActivity(client, ROLE, {
      start: new Date(0),
      end: new Date(),
      maxPages: 2,
    })
    expect(out.events).toHaveLength(2)
    expect(out.nextToken).toBe('more')
    const calls = ct.commandCalls(LookupEventsCommand)
    expect(calls).toHaveLength(2)
    expect(calls[0].args[0].input.LookupAttributes).toEqual([
      { AttributeKey: 'EventSource', AttributeValue: 'secretsmanager.amazonaws.com' },
    ])
  })

  it('maps AWS errors without their message', async () => {
    ct.on(LookupEventsCommand).rejects(
      Object.assign(new Error(PLANTED), { name: 'AccessDeniedException' }),
    )
    const client = new CloudTrailClient({ region: 'ap-southeast-1' })
    await expect(
      lookupActivity(client, ROLE, { start: new Date(0), end: new Date() }),
    ).rejects.toMatchObject({
      code: 'AccessDenied',
    })
  })
})
