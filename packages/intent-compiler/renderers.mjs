function list(values, fallback='None specified') {
  return values?.length ? values.map(value => `- ${value}`).join('\n') : fallback;
}

function authorityLines(authority={}) {
  const lines=[];
  if (authority.read?.length) lines.push(`Read: ${authority.read.join(', ')}`);
  if (authority.write?.length) lines.push(`Write: ${authority.write.join(', ')}`);
  if (authority.execute?.length) lines.push(`Execute: ${authority.execute.join(', ')}`);
  if (authority.network?.length) lines.push(`Network: ${authority.network.join(', ')}`);
  return lines.length ? lines.join('\n') : 'No elevated authority granted.';
}
export function renderIntent(ir, target='generic') {
  const scope=[
    ...(ir?.scope?.includes || []).map(value => `Include: ${value}`),
    ...(ir?.scope?.excludes || []).map(value => `Exclude: ${value}`),
  ];
  const verification = ir?.verification?.required
    ? list(ir.verification.obligations, ir.verification.completionRule || 'Verification required')
    : 'Use the stated completion rule.';

  const content = [
    'Objective',
    ir?.goal?.statement || '',
    '',
    'Context / Scope',
    list(scope),
    '',
    'Constraints',
    list(ir?.constraints || []),
  ];
  content.push(
    '',
    'Authority',
    authorityLines(ir?.authority),
    '',
    'Expected Output',
    ir?.output?.format || 'text',
    '',
    'Completion / Verification',
    verification,
  );

  return {
    target,
    mediaType:'text/plain',
    content:content.join('\n'),
    semanticMap:{
      goal:['goal'],
      constraints:['constraints'],
      authority:['authority'],
      verification:['verification'],
    },
  };
}
