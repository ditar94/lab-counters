import { z } from 'zod';
export declare const UserRoleSchema: z.ZodEnum<["superadmin", "admin", "supervisor", "technologist", "readonly"]>;
export declare const OrgUserRoleSchema: z.ZodEnum<["admin", "supervisor", "technologist", "readonly"]>;
export declare const UserStatusSchema: z.ZodEnum<["active", "inactive", "pending", "archived"]>;
export declare const OrgStatusSchema: z.ZodEnum<["active", "inactive", "archived"]>;
export declare const SiteStatusSchema: z.ZodEnum<["active", "inactive", "archived"]>;
export declare const CountRecordTypeSchema: z.ZodEnum<["hemocytometer", "fetal", "retic", "parasite"]>;
export declare const RecordStatusSchema: z.ZodEnum<["draft", "pending_verification", "verified", "corrected"]>;
export declare const FluidTypeSchema: z.ZodEnum<["csf", "synovial", "pleural", "peritoneal", "pericardial", "other"]>;
export declare const HemocytometerSideDataSchema: z.ZodObject<{
    rbcCount: z.ZodNumber;
    tncCount: z.ZodNumber;
    squaresCounted: z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>;
    dilutionFactor: z.ZodNumber;
    separateSettings: z.ZodBoolean;
    rbcSquaresCounted: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>>;
    rbcDilution: z.ZodOptional<z.ZodNumber>;
    tncSquaresCounted: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>>;
    tncDilution: z.ZodOptional<z.ZodNumber>;
    isDone: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    squaresCounted: 0.2 | 4 | 9;
    rbcCount: number;
    tncCount: number;
    dilutionFactor: number;
    separateSettings: boolean;
    isDone: boolean;
    rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
    rbcDilution?: number | undefined;
    tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
    tncDilution?: number | undefined;
}, {
    squaresCounted: 0.2 | 4 | 9;
    rbcCount: number;
    tncCount: number;
    dilutionFactor: number;
    separateSettings: boolean;
    isDone: boolean;
    rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
    rbcDilution?: number | undefined;
    tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
    tncDilution?: number | undefined;
}>;
export declare const HemocytometerDataSchema: z.ZodObject<{
    side1: z.ZodObject<{
        rbcCount: z.ZodNumber;
        tncCount: z.ZodNumber;
        squaresCounted: z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>;
        dilutionFactor: z.ZodNumber;
        separateSettings: z.ZodBoolean;
        rbcSquaresCounted: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>>;
        rbcDilution: z.ZodOptional<z.ZodNumber>;
        tncSquaresCounted: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>>;
        tncDilution: z.ZodOptional<z.ZodNumber>;
        isDone: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        squaresCounted: 0.2 | 4 | 9;
        rbcCount: number;
        tncCount: number;
        dilutionFactor: number;
        separateSettings: boolean;
        isDone: boolean;
        rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
        rbcDilution?: number | undefined;
        tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
        tncDilution?: number | undefined;
    }, {
        squaresCounted: 0.2 | 4 | 9;
        rbcCount: number;
        tncCount: number;
        dilutionFactor: number;
        separateSettings: boolean;
        isDone: boolean;
        rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
        rbcDilution?: number | undefined;
        tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
        tncDilution?: number | undefined;
    }>;
    side2: z.ZodObject<{
        rbcCount: z.ZodNumber;
        tncCount: z.ZodNumber;
        squaresCounted: z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>;
        dilutionFactor: z.ZodNumber;
        separateSettings: z.ZodBoolean;
        rbcSquaresCounted: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>>;
        rbcDilution: z.ZodOptional<z.ZodNumber>;
        tncSquaresCounted: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>>;
        tncDilution: z.ZodOptional<z.ZodNumber>;
        isDone: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        squaresCounted: 0.2 | 4 | 9;
        rbcCount: number;
        tncCount: number;
        dilutionFactor: number;
        separateSettings: boolean;
        isDone: boolean;
        rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
        rbcDilution?: number | undefined;
        tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
        tncDilution?: number | undefined;
    }, {
        squaresCounted: 0.2 | 4 | 9;
        rbcCount: number;
        tncCount: number;
        dilutionFactor: number;
        separateSettings: boolean;
        isDone: boolean;
        rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
        rbcDilution?: number | undefined;
        tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
        tncDilution?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    side1: {
        squaresCounted: 0.2 | 4 | 9;
        rbcCount: number;
        tncCount: number;
        dilutionFactor: number;
        separateSettings: boolean;
        isDone: boolean;
        rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
        rbcDilution?: number | undefined;
        tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
        tncDilution?: number | undefined;
    };
    side2: {
        squaresCounted: 0.2 | 4 | 9;
        rbcCount: number;
        tncCount: number;
        dilutionFactor: number;
        separateSettings: boolean;
        isDone: boolean;
        rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
        rbcDilution?: number | undefined;
        tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
        tncDilution?: number | undefined;
    };
}, {
    side1: {
        squaresCounted: 0.2 | 4 | 9;
        rbcCount: number;
        tncCount: number;
        dilutionFactor: number;
        separateSettings: boolean;
        isDone: boolean;
        rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
        rbcDilution?: number | undefined;
        tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
        tncDilution?: number | undefined;
    };
    side2: {
        squaresCounted: 0.2 | 4 | 9;
        rbcCount: number;
        tncCount: number;
        dilutionFactor: number;
        separateSettings: boolean;
        isDone: boolean;
        rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
        rbcDilution?: number | undefined;
        tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
        tncDilution?: number | undefined;
    };
}>;
export declare const FetalDataSchema: z.ZodObject<{
    fields: z.ZodArray<z.ZodNumber, "many">;
    fetalCellCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    fields: number[];
    fetalCellCount: number;
}, {
    fields: number[];
    fetalCellCount: number;
}>;
export declare const ReticDataSchema: z.ZodObject<{
    reticCount: z.ZodNumber;
    rbcCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    rbcCount: number;
    reticCount: number;
}, {
    rbcCount: number;
    reticCount: number;
}>;
export declare const ParasiteDataSchema: z.ZodObject<{
    parasiteCount: z.ZodNumber;
    rbcCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    rbcCount: number;
    parasiteCount: number;
}, {
    rbcCount: number;
    parasiteCount: number;
}>;
export declare const CountRecordDataSchema: z.ZodUnion<[z.ZodObject<{
    side1: z.ZodObject<{
        rbcCount: z.ZodNumber;
        tncCount: z.ZodNumber;
        squaresCounted: z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>;
        dilutionFactor: z.ZodNumber;
        separateSettings: z.ZodBoolean;
        rbcSquaresCounted: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>>;
        rbcDilution: z.ZodOptional<z.ZodNumber>;
        tncSquaresCounted: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>>;
        tncDilution: z.ZodOptional<z.ZodNumber>;
        isDone: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        squaresCounted: 0.2 | 4 | 9;
        rbcCount: number;
        tncCount: number;
        dilutionFactor: number;
        separateSettings: boolean;
        isDone: boolean;
        rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
        rbcDilution?: number | undefined;
        tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
        tncDilution?: number | undefined;
    }, {
        squaresCounted: 0.2 | 4 | 9;
        rbcCount: number;
        tncCount: number;
        dilutionFactor: number;
        separateSettings: boolean;
        isDone: boolean;
        rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
        rbcDilution?: number | undefined;
        tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
        tncDilution?: number | undefined;
    }>;
    side2: z.ZodObject<{
        rbcCount: z.ZodNumber;
        tncCount: z.ZodNumber;
        squaresCounted: z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>;
        dilutionFactor: z.ZodNumber;
        separateSettings: z.ZodBoolean;
        rbcSquaresCounted: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>>;
        rbcDilution: z.ZodOptional<z.ZodNumber>;
        tncSquaresCounted: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>>;
        tncDilution: z.ZodOptional<z.ZodNumber>;
        isDone: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        squaresCounted: 0.2 | 4 | 9;
        rbcCount: number;
        tncCount: number;
        dilutionFactor: number;
        separateSettings: boolean;
        isDone: boolean;
        rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
        rbcDilution?: number | undefined;
        tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
        tncDilution?: number | undefined;
    }, {
        squaresCounted: 0.2 | 4 | 9;
        rbcCount: number;
        tncCount: number;
        dilutionFactor: number;
        separateSettings: boolean;
        isDone: boolean;
        rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
        rbcDilution?: number | undefined;
        tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
        tncDilution?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    side1: {
        squaresCounted: 0.2 | 4 | 9;
        rbcCount: number;
        tncCount: number;
        dilutionFactor: number;
        separateSettings: boolean;
        isDone: boolean;
        rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
        rbcDilution?: number | undefined;
        tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
        tncDilution?: number | undefined;
    };
    side2: {
        squaresCounted: 0.2 | 4 | 9;
        rbcCount: number;
        tncCount: number;
        dilutionFactor: number;
        separateSettings: boolean;
        isDone: boolean;
        rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
        rbcDilution?: number | undefined;
        tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
        tncDilution?: number | undefined;
    };
}, {
    side1: {
        squaresCounted: 0.2 | 4 | 9;
        rbcCount: number;
        tncCount: number;
        dilutionFactor: number;
        separateSettings: boolean;
        isDone: boolean;
        rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
        rbcDilution?: number | undefined;
        tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
        tncDilution?: number | undefined;
    };
    side2: {
        squaresCounted: 0.2 | 4 | 9;
        rbcCount: number;
        tncCount: number;
        dilutionFactor: number;
        separateSettings: boolean;
        isDone: boolean;
        rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
        rbcDilution?: number | undefined;
        tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
        tncDilution?: number | undefined;
    };
}>, z.ZodObject<{
    fields: z.ZodArray<z.ZodNumber, "many">;
    fetalCellCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    fields: number[];
    fetalCellCount: number;
}, {
    fields: number[];
    fetalCellCount: number;
}>, z.ZodObject<{
    reticCount: z.ZodNumber;
    rbcCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    rbcCount: number;
    reticCount: number;
}, {
    rbcCount: number;
    reticCount: number;
}>, z.ZodObject<{
    parasiteCount: z.ZodNumber;
    rbcCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    rbcCount: number;
    parasiteCount: number;
}, {
    rbcCount: number;
    parasiteCount: number;
}>]>;
export declare const CreateRecordRequestSchema: z.ZodObject<{
    type: z.ZodEnum<["hemocytometer", "fetal", "retic", "parasite"]>;
    specimenId: z.ZodString;
    fluidType: z.ZodEnum<["csf", "synovial", "pleural", "peritoneal", "pericardial", "other"]>;
    dilution: z.ZodNumber;
    squaresCounted: z.ZodNumber;
    isQC: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    rawTallies: z.ZodUnion<[z.ZodObject<{
        side1: z.ZodObject<{
            rbcCount: z.ZodNumber;
            tncCount: z.ZodNumber;
            squaresCounted: z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>;
            dilutionFactor: z.ZodNumber;
            separateSettings: z.ZodBoolean;
            rbcSquaresCounted: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>>;
            rbcDilution: z.ZodOptional<z.ZodNumber>;
            tncSquaresCounted: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>>;
            tncDilution: z.ZodOptional<z.ZodNumber>;
            isDone: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        }, {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        }>;
        side2: z.ZodObject<{
            rbcCount: z.ZodNumber;
            tncCount: z.ZodNumber;
            squaresCounted: z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>;
            dilutionFactor: z.ZodNumber;
            separateSettings: z.ZodBoolean;
            rbcSquaresCounted: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>>;
            rbcDilution: z.ZodOptional<z.ZodNumber>;
            tncSquaresCounted: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>>;
            tncDilution: z.ZodOptional<z.ZodNumber>;
            isDone: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        }, {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        side1: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
        side2: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
    }, {
        side1: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
        side2: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
    }>, z.ZodObject<{
        fields: z.ZodArray<z.ZodNumber, "many">;
        fetalCellCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        fields: number[];
        fetalCellCount: number;
    }, {
        fields: number[];
        fetalCellCount: number;
    }>, z.ZodObject<{
        reticCount: z.ZodNumber;
        rbcCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        rbcCount: number;
        reticCount: number;
    }, {
        rbcCount: number;
        reticCount: number;
    }>, z.ZodObject<{
        parasiteCount: z.ZodNumber;
        rbcCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        rbcCount: number;
        parasiteCount: number;
    }, {
        rbcCount: number;
        parasiteCount: number;
    }>]>;
}, "strip", z.ZodTypeAny, {
    rawTallies: {
        side1: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
        side2: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
    } | {
        fields: number[];
        fetalCellCount: number;
    } | {
        rbcCount: number;
        reticCount: number;
    } | {
        rbcCount: number;
        parasiteCount: number;
    };
    type: "hemocytometer" | "fetal" | "retic" | "parasite";
    specimenId: string;
    fluidType: "csf" | "synovial" | "pleural" | "peritoneal" | "pericardial" | "other";
    dilution: number;
    squaresCounted: number;
    isQC: boolean;
}, {
    rawTallies: {
        side1: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
        side2: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
    } | {
        fields: number[];
        fetalCellCount: number;
    } | {
        rbcCount: number;
        reticCount: number;
    } | {
        rbcCount: number;
        parasiteCount: number;
    };
    type: "hemocytometer" | "fetal" | "retic" | "parasite";
    specimenId: string;
    fluidType: "csf" | "synovial" | "pleural" | "peritoneal" | "pericardial" | "other";
    dilution: number;
    squaresCounted: number;
    isQC?: boolean | undefined;
}>;
export declare const UpdateRecordRequestSchema: z.ZodObject<{
    rawTallies: z.ZodOptional<z.ZodUnion<[z.ZodObject<{
        side1: z.ZodObject<{
            rbcCount: z.ZodNumber;
            tncCount: z.ZodNumber;
            squaresCounted: z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>;
            dilutionFactor: z.ZodNumber;
            separateSettings: z.ZodBoolean;
            rbcSquaresCounted: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>>;
            rbcDilution: z.ZodOptional<z.ZodNumber>;
            tncSquaresCounted: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>>;
            tncDilution: z.ZodOptional<z.ZodNumber>;
            isDone: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        }, {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        }>;
        side2: z.ZodObject<{
            rbcCount: z.ZodNumber;
            tncCount: z.ZodNumber;
            squaresCounted: z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>;
            dilutionFactor: z.ZodNumber;
            separateSettings: z.ZodBoolean;
            rbcSquaresCounted: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>>;
            rbcDilution: z.ZodOptional<z.ZodNumber>;
            tncSquaresCounted: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>>;
            tncDilution: z.ZodOptional<z.ZodNumber>;
            isDone: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        }, {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        side1: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
        side2: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
    }, {
        side1: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
        side2: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
    }>, z.ZodObject<{
        fields: z.ZodArray<z.ZodNumber, "many">;
        fetalCellCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        fields: number[];
        fetalCellCount: number;
    }, {
        fields: number[];
        fetalCellCount: number;
    }>, z.ZodObject<{
        reticCount: z.ZodNumber;
        rbcCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        rbcCount: number;
        reticCount: number;
    }, {
        rbcCount: number;
        reticCount: number;
    }>, z.ZodObject<{
        parasiteCount: z.ZodNumber;
        rbcCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        rbcCount: number;
        parasiteCount: number;
    }, {
        rbcCount: number;
        parasiteCount: number;
    }>]>>;
    status: z.ZodOptional<z.ZodEnum<["draft", "pending_verification", "verified", "corrected"]>>;
}, "strip", z.ZodTypeAny, {
    rawTallies?: {
        side1: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
        side2: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
    } | {
        fields: number[];
        fetalCellCount: number;
    } | {
        rbcCount: number;
        reticCount: number;
    } | {
        rbcCount: number;
        parasiteCount: number;
    } | undefined;
    status?: "draft" | "pending_verification" | "verified" | "corrected" | undefined;
}, {
    rawTallies?: {
        side1: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
        side2: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
    } | {
        fields: number[];
        fetalCellCount: number;
    } | {
        rbcCount: number;
        reticCount: number;
    } | {
        rbcCount: number;
        parasiteCount: number;
    } | undefined;
    status?: "draft" | "pending_verification" | "verified" | "corrected" | undefined;
}>;
export declare const SubmitRecordRequestSchema: z.ZodObject<{
    performerAttestation: z.ZodString;
}, "strip", z.ZodTypeAny, {
    performerAttestation: string;
}, {
    performerAttestation: string;
}>;
export declare const VerifyRecordRequestSchema: z.ZodObject<{
    comments: z.ZodOptional<z.ZodString>;
    verifierAttestation: z.ZodString;
}, "strip", z.ZodTypeAny, {
    verifierAttestation: string;
    comments?: string | undefined;
}, {
    verifierAttestation: string;
    comments?: string | undefined;
}>;
export declare const CreateCorrectionRequestSchema: z.ZodObject<{
    reason: z.ZodString;
    rawTallies: z.ZodOptional<z.ZodUnion<[z.ZodObject<{
        side1: z.ZodObject<{
            rbcCount: z.ZodNumber;
            tncCount: z.ZodNumber;
            squaresCounted: z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>;
            dilutionFactor: z.ZodNumber;
            separateSettings: z.ZodBoolean;
            rbcSquaresCounted: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>>;
            rbcDilution: z.ZodOptional<z.ZodNumber>;
            tncSquaresCounted: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>>;
            tncDilution: z.ZodOptional<z.ZodNumber>;
            isDone: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        }, {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        }>;
        side2: z.ZodObject<{
            rbcCount: z.ZodNumber;
            tncCount: z.ZodNumber;
            squaresCounted: z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>;
            dilutionFactor: z.ZodNumber;
            separateSettings: z.ZodBoolean;
            rbcSquaresCounted: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>>;
            rbcDilution: z.ZodOptional<z.ZodNumber>;
            tncSquaresCounted: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>>;
            tncDilution: z.ZodOptional<z.ZodNumber>;
            isDone: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        }, {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        side1: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
        side2: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
    }, {
        side1: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
        side2: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
    }>, z.ZodObject<{
        fields: z.ZodArray<z.ZodNumber, "many">;
        fetalCellCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        fields: number[];
        fetalCellCount: number;
    }, {
        fields: number[];
        fetalCellCount: number;
    }>, z.ZodObject<{
        reticCount: z.ZodNumber;
        rbcCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        rbcCount: number;
        reticCount: number;
    }, {
        rbcCount: number;
        reticCount: number;
    }>, z.ZodObject<{
        parasiteCount: z.ZodNumber;
        rbcCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        rbcCount: number;
        parasiteCount: number;
    }, {
        rbcCount: number;
        parasiteCount: number;
    }>]>>;
    specimenId: z.ZodOptional<z.ZodString>;
    performedAt: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    reason: string;
    rawTallies?: {
        side1: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
        side2: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
    } | {
        fields: number[];
        fetalCellCount: number;
    } | {
        rbcCount: number;
        reticCount: number;
    } | {
        rbcCount: number;
        parasiteCount: number;
    } | undefined;
    specimenId?: string | undefined;
    performedAt?: Date | undefined;
}, {
    reason: string;
    rawTallies?: {
        side1: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
        side2: {
            squaresCounted: 0.2 | 4 | 9;
            rbcCount: number;
            tncCount: number;
            dilutionFactor: number;
            separateSettings: boolean;
            isDone: boolean;
            rbcSquaresCounted?: 0.2 | 4 | 9 | undefined;
            rbcDilution?: number | undefined;
            tncSquaresCounted?: 0.2 | 4 | 9 | undefined;
            tncDilution?: number | undefined;
        };
    } | {
        fields: number[];
        fetalCellCount: number;
    } | {
        rbcCount: number;
        reticCount: number;
    } | {
        rbcCount: number;
        parasiteCount: number;
    } | undefined;
    specimenId?: string | undefined;
    performedAt?: Date | undefined;
}>;
export declare const ResetPasswordRequestSchema: z.ZodObject<{
    temporaryPassword: z.ZodOptional<z.ZodString>;
    generateTemporaryPassword: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    temporaryPassword?: string | undefined;
    generateTemporaryPassword?: boolean | undefined;
}, {
    temporaryPassword?: string | undefined;
    generateTemporaryPassword?: boolean | undefined;
}>;
export declare const PaginationQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export declare const RecordFilterSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
} & {
    type: z.ZodOptional<z.ZodEnum<["hemocytometer", "fetal", "retic", "parasite"]>>;
    status: z.ZodOptional<z.ZodEnum<["draft", "pending_verification", "verified", "corrected"]>>;
    specimenId: z.ZodOptional<z.ZodString>;
    startDate: z.ZodOptional<z.ZodDate>;
    endDate: z.ZodOptional<z.ZodDate>;
    performedBy: z.ZodOptional<z.ZodString>;
    siteId: z.ZodOptional<z.ZodString>;
    month: z.ZodOptional<z.ZodNumber>;
    year: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    type?: "hemocytometer" | "fetal" | "retic" | "parasite" | undefined;
    siteId?: string | undefined;
    specimenId?: string | undefined;
    status?: "draft" | "pending_verification" | "verified" | "corrected" | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    performedBy?: string | undefined;
    month?: number | undefined;
    year?: number | undefined;
}, {
    type?: "hemocytometer" | "fetal" | "retic" | "parasite" | undefined;
    siteId?: string | undefined;
    specimenId?: string | undefined;
    status?: "draft" | "pending_verification" | "verified" | "corrected" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    performedBy?: string | undefined;
    month?: number | undefined;
    year?: number | undefined;
}>;
export declare const CreateUserRequestSchema: z.ZodObject<{
    username: z.ZodOptional<z.ZodString>;
    email: z.ZodString;
    name: z.ZodString;
    role: z.ZodEnum<["admin", "supervisor", "technologist", "readonly"]>;
    siteId: z.ZodString;
    siteIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    temporaryPassword: z.ZodOptional<z.ZodString>;
    generateTemporaryPassword: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    siteId: string;
    email: string;
    name: string;
    role: "admin" | "supervisor" | "technologist" | "readonly";
    temporaryPassword?: string | undefined;
    generateTemporaryPassword?: boolean | undefined;
    username?: string | undefined;
    siteIds?: string[] | undefined;
}, {
    siteId: string;
    email: string;
    name: string;
    role: "admin" | "supervisor" | "technologist" | "readonly";
    temporaryPassword?: string | undefined;
    generateTemporaryPassword?: boolean | undefined;
    username?: string | undefined;
    siteIds?: string[] | undefined;
}>;
export declare const UpdateUserRequestSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodEnum<["admin", "supervisor", "technologist", "readonly"]>>;
    siteId: z.ZodOptional<z.ZodString>;
    siteIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    status: z.ZodOptional<z.ZodEnum<["active", "inactive", "pending", "archived"]>>;
}, "strip", z.ZodTypeAny, {
    siteId?: string | undefined;
    status?: "active" | "inactive" | "pending" | "archived" | undefined;
    name?: string | undefined;
    role?: "admin" | "supervisor" | "technologist" | "readonly" | undefined;
    siteIds?: string[] | undefined;
}, {
    siteId?: string | undefined;
    status?: "active" | "inactive" | "pending" | "archived" | undefined;
    name?: string | undefined;
    role?: "admin" | "supervisor" | "technologist" | "readonly" | undefined;
    siteIds?: string[] | undefined;
}>;
export declare const OrganizationSettingsSchema: z.ZodObject<{
    timezone: z.ZodDefault<z.ZodString>;
    defaultDilution: z.ZodDefault<z.ZodNumber>;
    requireVerification: z.ZodDefault<z.ZodBoolean>;
    allowSelfVerification: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    timezone: string;
    defaultDilution: number;
    requireVerification: boolean;
    allowSelfVerification: boolean;
}, {
    timezone?: string | undefined;
    defaultDilution?: number | undefined;
    requireVerification?: boolean | undefined;
    allowSelfVerification?: boolean | undefined;
}>;
export declare const CreateOrganizationSchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodString;
    settings: z.ZodOptional<z.ZodObject<{
        timezone: z.ZodOptional<z.ZodDefault<z.ZodString>>;
        defaultDilution: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
        requireVerification: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        allowSelfVerification: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        timezone?: string | undefined;
        defaultDilution?: number | undefined;
        requireVerification?: boolean | undefined;
        allowSelfVerification?: boolean | undefined;
    }, {
        timezone?: string | undefined;
        defaultDilution?: number | undefined;
        requireVerification?: boolean | undefined;
        allowSelfVerification?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    slug: string;
    settings?: {
        timezone?: string | undefined;
        defaultDilution?: number | undefined;
        requireVerification?: boolean | undefined;
        allowSelfVerification?: boolean | undefined;
    } | undefined;
}, {
    name: string;
    slug: string;
    settings?: {
        timezone?: string | undefined;
        defaultDilution?: number | undefined;
        requireVerification?: boolean | undefined;
        allowSelfVerification?: boolean | undefined;
    } | undefined;
}>;
export declare const UpdateOrganizationSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    settings: z.ZodOptional<z.ZodObject<{
        timezone: z.ZodOptional<z.ZodDefault<z.ZodString>>;
        defaultDilution: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
        requireVerification: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        allowSelfVerification: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        timezone?: string | undefined;
        defaultDilution?: number | undefined;
        requireVerification?: boolean | undefined;
        allowSelfVerification?: boolean | undefined;
    }, {
        timezone?: string | undefined;
        defaultDilution?: number | undefined;
        requireVerification?: boolean | undefined;
        allowSelfVerification?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    settings?: {
        timezone?: string | undefined;
        defaultDilution?: number | undefined;
        requireVerification?: boolean | undefined;
        allowSelfVerification?: boolean | undefined;
    } | undefined;
}, {
    name?: string | undefined;
    settings?: {
        timezone?: string | undefined;
        defaultDilution?: number | undefined;
        requireVerification?: boolean | undefined;
        allowSelfVerification?: boolean | undefined;
    } | undefined;
}>;
export declare const SiteSettingsSchema: z.ZodObject<{
    timezone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    timezone?: string | undefined;
}, {
    timezone?: string | undefined;
}>;
export declare const CreateSiteSchema: z.ZodObject<{
    name: z.ZodString;
    location: z.ZodOptional<z.ZodString>;
    settings: z.ZodOptional<z.ZodObject<{
        timezone: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        timezone?: string | undefined;
    }, {
        timezone?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    settings?: {
        timezone?: string | undefined;
    } | undefined;
    location?: string | undefined;
}, {
    name: string;
    settings?: {
        timezone?: string | undefined;
    } | undefined;
    location?: string | undefined;
}>;
export declare const UpdateSiteSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    settings: z.ZodOptional<z.ZodObject<{
        timezone: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        timezone?: string | undefined;
    }, {
        timezone?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    settings?: {
        timezone?: string | undefined;
    } | undefined;
    location?: string | undefined;
}, {
    name?: string | undefined;
    settings?: {
        timezone?: string | undefined;
    } | undefined;
    location?: string | undefined;
}>;
export declare const CreateOrgAdminSchema: z.ZodObject<{
    username: z.ZodOptional<z.ZodString>;
    email: z.ZodString;
    name: z.ZodString;
    siteId: z.ZodString;
    siteIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    temporaryPassword: z.ZodOptional<z.ZodString>;
    generateTemporaryPassword: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    siteId: string;
    email: string;
    name: string;
    temporaryPassword?: string | undefined;
    generateTemporaryPassword?: boolean | undefined;
    username?: string | undefined;
    siteIds?: string[] | undefined;
}, {
    siteId: string;
    email: string;
    name: string;
    temporaryPassword?: string | undefined;
    generateTemporaryPassword?: boolean | undefined;
    username?: string | undefined;
    siteIds?: string[] | undefined;
}>;
export declare const HemocytometerMethodParamsSchema: z.ZodObject<{
    defaultDilution: z.ZodNumber;
    defaultSquaresCounted: z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>;
    tolerancePercent: z.ZodNumber;
    lowCountTolerance: z.ZodNumber;
    lowCountThreshold: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    defaultDilution: number;
    defaultSquaresCounted: 0.2 | 4 | 9;
    tolerancePercent: number;
    lowCountTolerance: number;
    lowCountThreshold: number;
}, {
    defaultDilution: number;
    defaultSquaresCounted: 0.2 | 4 | 9;
    tolerancePercent: number;
    lowCountTolerance: number;
    lowCountThreshold: number;
}>;
export declare const FetalMethodParamsSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export declare const ReticMethodParamsSchema: z.ZodObject<{
    targetRbcCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    targetRbcCount: number;
}, {
    targetRbcCount: number;
}>;
export declare const ParasiteMethodParamsSchema: z.ZodObject<{
    targetRbcCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    targetRbcCount: number;
}, {
    targetRbcCount: number;
}>;
/** Schema for updating org method config - uses discriminated union by counterType */
export declare const UpdateOrgMethodConfigSchema: z.ZodDiscriminatedUnion<"counterType", [z.ZodObject<{
    counterType: z.ZodLiteral<"hemocytometer">;
    config: z.ZodObject<{
        defaultDilution: z.ZodOptional<z.ZodNumber>;
        defaultSquaresCounted: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<0.2>, z.ZodLiteral<4>, z.ZodLiteral<9>]>>;
        tolerancePercent: z.ZodOptional<z.ZodNumber>;
        lowCountTolerance: z.ZodOptional<z.ZodNumber>;
        lowCountThreshold: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        defaultDilution?: number | undefined;
        defaultSquaresCounted?: 0.2 | 4 | 9 | undefined;
        tolerancePercent?: number | undefined;
        lowCountTolerance?: number | undefined;
        lowCountThreshold?: number | undefined;
    }, {
        defaultDilution?: number | undefined;
        defaultSquaresCounted?: 0.2 | 4 | 9 | undefined;
        tolerancePercent?: number | undefined;
        lowCountTolerance?: number | undefined;
        lowCountThreshold?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    counterType: "hemocytometer";
    config: {
        defaultDilution?: number | undefined;
        defaultSquaresCounted?: 0.2 | 4 | 9 | undefined;
        tolerancePercent?: number | undefined;
        lowCountTolerance?: number | undefined;
        lowCountThreshold?: number | undefined;
    };
}, {
    counterType: "hemocytometer";
    config: {
        defaultDilution?: number | undefined;
        defaultSquaresCounted?: 0.2 | 4 | 9 | undefined;
        tolerancePercent?: number | undefined;
        lowCountTolerance?: number | undefined;
        lowCountThreshold?: number | undefined;
    };
}>, z.ZodObject<{
    counterType: z.ZodLiteral<"fetal">;
    config: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
}, "strip", z.ZodTypeAny, {
    counterType: "fetal";
    config: {};
}, {
    counterType: "fetal";
    config: {};
}>, z.ZodObject<{
    counterType: z.ZodLiteral<"retic">;
    config: z.ZodObject<{
        targetRbcCount: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        targetRbcCount?: number | undefined;
    }, {
        targetRbcCount?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    counterType: "retic";
    config: {
        targetRbcCount?: number | undefined;
    };
}, {
    counterType: "retic";
    config: {
        targetRbcCount?: number | undefined;
    };
}>, z.ZodObject<{
    counterType: z.ZodLiteral<"parasite">;
    config: z.ZodObject<{
        targetRbcCount: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        targetRbcCount?: number | undefined;
    }, {
        targetRbcCount?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    counterType: "parasite";
    config: {
        targetRbcCount?: number | undefined;
    };
}, {
    counterType: "parasite";
    config: {
        targetRbcCount?: number | undefined;
    };
}>]>;
