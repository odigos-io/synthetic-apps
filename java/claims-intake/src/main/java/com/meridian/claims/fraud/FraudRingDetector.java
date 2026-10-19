package com.meridian.claims.fraud;

import org.springframework.stereotype.Component;

import com.meridian.claims.config.Knobs;
import com.meridian.claims.domain.ClaimSubmission;

/**
 * Release 2.4: looks for claimants who share bank accounts, addresses or phone
 * numbers across policies. Graph traversal is linear in the attachment count
 * because every document adds entities to link. Only runs when the
 * fraudRingDetection flag is on.
 */
@Component
public class FraudRingDetector {
    private final int work = Knobs.intEnv("RING_WORK", 2_500_000);
    private final int perAttachmentWork = Knobs.intEnv("RING_ATTACHMENT_WORK", 600_000);

    public double detectRings(ClaimSubmission submission) {
        long budget = work + (long) perAttachmentWork * submission.attachments();
        long x = submission.policyNumber().hashCode() | 1;
        long linked = 0;
        for (long i = 0; i < budget; i++) {
            x ^= x << 13;
            x ^= x >>> 7;
            x ^= x << 17;
            if ((x & 0xfffff) == 0) {
                linked++;
            }
        }
        return Math.min(1.0, linked / 10.0);
    }
}
