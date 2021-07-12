import React from 'react'
import { ValidateNumber } from './RegexValidation'
export default (val: string, hookSetter: (value: any) => void) => {
    const check: boolean = ValidateNumber(val);
    hookSetter(check ? val : String(Number(val)));
    // if (!check) return;
}
