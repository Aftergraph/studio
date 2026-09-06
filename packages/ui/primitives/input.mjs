import { AGIcon, esc, attr } from '../shared.mjs';

export function AGInput({label,value='',placeholder='',name='value'}) {
  return `<label class="ag-input" data-ag-component="input"><span>${esc(label)}</span><input name="${attr(name)}" value="${attr(value)}" placeholder="${attr(placeholder)}" /></label>`;
}
