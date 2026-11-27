/** Contain keyboard focus in a dialog, including focus moved outside by scripts.
 * @param {KeyboardEvent} event
 * @param {HTMLElement|null} modal
 * @param {Element|null} active
 */
export function trapFocus(event,modal,active){
  if(event.key!=='Tab'||!modal)return;
  const controls=[...modal.querySelectorAll('button,a[href],input,textarea,select,[tabindex]')]
    .filter(x=>!x.disabled&&x.getClientRects().length>0&&x.tabIndex>=0);
  const first=controls[0],last=controls.at(-1);
  if(!first){event.preventDefault();modal.focus();}
  else if(!modal.contains(active)){event.preventDefault();first.focus();}
  else if(event.shiftKey&&active===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&active===last){event.preventDefault();first.focus();}
}
