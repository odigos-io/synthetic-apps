package com.meridian.claims.intake;

import org.springframework.stereotype.Component;

import com.meridian.claims.config.Knobs;
import com.meridian.claims.domain.ClaimSubmission;

/**
 * Renders the claim summary PDF that goes to the adjuster queue. Cost is linear
 * in the number of attached documents (photos, police reports, invoices).
 */
@Component
public class ClaimDocumentRenderer {
    private final int baseWork = Knobs.intEnv("RENDER_BASE_WORK", 300_000);
    private final int perAttachmentWork = Knobs.intEnv("RENDER_ATTACHMENT_WORK", 450_000);

    public int renderClaimSummary(String claimId, ClaimSubmission submission) {
        long budget = baseWork + (long) perAttachmentWork * submission.attachments();
        long x = claimId.hashCode() | 1;
        for (long i = 0; i < budget; i++) {
            x ^= x << 13;
            x ^= x >>> 7;
            x ^= x << 17;
        }
        return (int) (1 + submission.attachments() + (x & 1));
    }
}
