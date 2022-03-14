import { CortexDebugExtension } from './extension';
import { RegisterNode } from './views/nodes/registernode';

export function getRegisters() {
    
    const registers: RegisterNode[] = [];

    const session = CortexDebugExtension.getActiveCDSession();
    const shite = session.customRequest('read-register-list').then((data) => {
        data.forEach((reg, idx) => {
          if (reg) {
            //const rn = new RegisterNode(reg, idx);
            registers.push(reg);
            //this.registerMap[idx] = reg;
          }
            // const index = parseInt(reg.number, 10);
            // const regNode = this.registerMap[index];
            // if (regNode) { regNode.setValue(reg.value); }
        });
    });
    return shite;
}