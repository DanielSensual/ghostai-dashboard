/**
 * In-memory lead pipeline store.
 * Lead hunter pushes to /api/lead-pipeline and UI reads from the same endpoint.
 */

const DEFAULT_PIPELINE = {
    totalLeads: 0,
    hotLeads: 0,
    warmLeads: 0,
    withEmail: 0,
    contacted: 0,
    replied: 0,
    booked: 0,
    totalOutreach: 0,
    todayOutreach: 0,
    replyRate: 0,
    bookRate: 0,
    suppressionCount: 0,
    segmentBreakdown: [],
    dailySendSeries: [],
};

let leadPipelineData = {
    lastSync: null,
    pipeline: DEFAULT_PIPELINE,
    campaigns: [],
    topLeads: [],
};

export function getLeadPipelineData() {
    return leadPipelineData;
}

export function setLeadPipelineData(nextData) {
    leadPipelineData = {
        ...leadPipelineData,
        ...nextData,
        pipeline: {
            ...DEFAULT_PIPELINE,
            ...(nextData?.pipeline || {}),
        },
        lastSync: new Date().toISOString(),
    };
}
