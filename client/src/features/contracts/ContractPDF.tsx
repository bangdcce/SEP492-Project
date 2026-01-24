import { Document, Page, Text, View, StyleSheet, Link } from '@react-pdf/renderer';

// Define styles for the PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 30,
    borderBottom: '2 solid #2563eb',
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 10,
    borderBottom: '1 solid #e2e8f0',
    paddingBottom: 5,
  },
  text: {
    fontSize: 11,
    lineHeight: 1.6,
    color: '#334155',
    marginBottom: 8,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#0f172a',
  },
  table: {
    marginTop: 10,
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    padding: 8,
    borderBottom: '2 solid #cbd5e1',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottom: '1 solid #e2e8f0',
  },
  tableCol: {
    flex: 1,
  },
  tableColTitle: {
    flex: 2,
  },
  tableColAmount: {
    flex: 1,
    textAlign: 'right',
  },
  headerText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#475569',
  },
  featureItem: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderLeft: '3 solid #3b82f6',
  },
  featureTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 6,
  },
  complexityBadge: {
    fontSize: 9,
    padding: '3 8',
    borderRadius: 3,
    marginLeft: 8,
  },
  complexityLow: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  complexityMedium: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  complexityHigh: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  criteriaList: {
    marginLeft: 15,
    marginTop: 5,
  },
  criteriaItem: {
    fontSize: 10,
    color: '#475569',
    marginBottom: 3,
    lineHeight: 1.4,
  },
  milestoneCard: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#fefce8',
    border: '1 solid #fde047',
    borderRadius: 4,
  },
  milestoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  milestoneTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#854d0e',
  },
  milestoneAmount: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#15803d',
  },
  milestoneDetail: {
    fontSize: 9,
    color: '#78716c',
    marginBottom: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: '1 solid #e2e8f0',
    paddingTop: 10,
    fontSize: 9,
    color: '#94a3b8',
    textAlign: 'center',
  },
  signatureSection: {
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBox: {
    width: '45%',
    padding: 15,
    border: '1 solid #cbd5e1',
    borderRadius: 4,
  },
  signatureLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 30,
  },
  signatureLine: {
    borderTop: '1 solid #94a3b8',
    marginTop: 10,
    paddingTop: 5,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  infoLabel: {
    width: 120,
    fontSize: 10,
    color: '#64748b',
  },
  infoValue: {
    flex: 1,
    fontSize: 10,
    color: '#0f172a',
    fontWeight: 'bold',
  },
  link: {
    color: '#2563eb',
    textDecoration: 'underline',
    fontSize: 10,
  },
  referenceItem: {
    marginBottom: 5,
    fontSize: 10,
  },
});

interface ContractPDFProps {
  contract: {
    id: string;
    title: string;
    termsContent: string;
    createdAt: string;
    project: {
      title: string;
      description: string;
      totalBudget: number;
      client?: {
        fullName: string;
        email: string;
      };
      broker?: {
        fullName: string;
        email: string;
      };
      request?: {
        spec?: {
          title: string;
          description: string;
          totalBudget: number;
          techStack?: string;
          referenceLinks?: Array<{
            label: string;
            url: string;
          }>;
          features?: Array<{
            id: string;
            title: string;
            description: string;
            complexity: 'LOW' | 'MEDIUM' | 'HIGH';
            acceptanceCriteria: string[];
            inputOutputSpec?: string;
          }>;
          milestones?: Array<{
            id: string;
            title: string;
            description?: string;
            amount: number;
            deliverableType: string;
            retentionAmount?: number;
            acceptanceCriteria?: string[];
            sortOrder?: number;
            dueDate?: string;
          }>;
        };
      };
    };
  };
}

export const ContractPDF = ({ contract }: ContractPDFProps) => {
  const spec = contract.project.request?.spec;
  const milestones = spec?.milestones?.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) || [];
  const features = spec?.features || [];
  const referenceLinks = spec?.referenceLinks || [];

  const getComplexityStyle = (complexity: 'LOW' | 'MEDIUM' | 'HIGH') => {
    switch (complexity) {
      case 'LOW': return styles.complexityLow;
      case 'MEDIUM': return styles.complexityMedium;
      case 'HIGH': return styles.complexityHigh;
      default: return styles.complexityLow;
    }
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>DEVELOPMENT AGREEMENT</Text>
          <Text style={styles.subtitle}>Contract ID: {contract.id}</Text>
          <Text style={styles.subtitle}>
            Date: {new Date(contract.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>

        {/* Parties Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. PARTIES</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Client:</Text>
            <Text style={styles.infoValue}>
              {contract.project.client?.fullName || 'N/A'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>
              {contract.project.client?.email || 'N/A'}
            </Text>
          </View>

          <View style={{ marginTop: 10 }}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Broker:</Text>
              <Text style={styles.infoValue}>
                {contract.project.broker?.fullName || 'N/A'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>
                {contract.project.broker?.email || 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Scope of Work */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. SCOPE OF WORK</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Project:</Text>
            <Text style={styles.infoValue}>{contract.project.title}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Budget:</Text>
            <Text style={styles.infoValue}>
              ${contract.project.totalBudget.toLocaleString()}
            </Text>
          </View>
          {spec?.description && (
            <Text style={[styles.text, { marginTop: 10 }]}>
              {spec.description}
            </Text>
          )}
        </View>

        {/* Features & Acceptance Criteria */}
        {features.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. FEATURES & ACCEPTANCE CRITERIA</Text>
            {features.map((feature, idx) => (
              <View key={feature.id} style={styles.featureItem}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.featureTitle}>
                    {idx + 1}. {feature.title}
                  </Text>
                  <Text style={[styles.complexityBadge, getComplexityStyle(feature.complexity)]}>
                    {feature.complexity}
                  </Text>
                </View>
                <Text style={[styles.text, { fontSize: 10 }]}>
                  {feature.description}
                </Text>
                {feature.inputOutputSpec && (
                  <Text style={[styles.text, { fontSize: 9, fontStyle: 'italic', color: '#64748b' }]}>
                    I/O Spec: {feature.inputOutputSpec}
                  </Text>
                )}
                {feature.acceptanceCriteria && feature.acceptanceCriteria.length > 0 && (
                  <View style={styles.criteriaList}>
                    <Text style={[styles.boldText, { fontSize: 10, marginBottom: 4 }]}>
                      Acceptance Criteria:
                    </Text>
                    {feature.acceptanceCriteria.map((criteria, cIdx) => (
                      <Text key={cIdx} style={styles.criteriaItem}>
                        ✓ {criteria}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Tech Stack */}
        {spec?.techStack && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. TECHNOLOGY STACK</Text>
            <Text style={styles.text}>{spec.techStack}</Text>
          </View>
        )}

        {/* Reference Links */}
        {referenceLinks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. REFERENCE DOCUMENTS</Text>
            {referenceLinks.map((link, idx) => (
              <View key={idx} style={styles.referenceItem}>
                <Text style={styles.text}>
                  {link.label}:{' '}
                  <Link src={link.url} style={styles.link}>
                    {link.url}
                  </Link>
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Payment Schedule - Enhanced */}
        {milestones.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {referenceLinks.length > 0 ? '6' : '5'}. PAYMENT SCHEDULE (MILESTONES)
            </Text>
            {milestones.map((milestone, idx) => (
              <View key={milestone.id} style={styles.milestoneCard}>
                <View style={styles.milestoneHeader}>
                  <Text style={styles.milestoneTitle}>
                    Milestone {idx + 1}: {milestone.title}
                  </Text>
                  <Text style={styles.milestoneAmount}>
                    ${Number(milestone.amount).toLocaleString()}
                  </Text>
                </View>
                
                {milestone.description && (
                  <Text style={[styles.text, { fontSize: 10, marginBottom: 5 }]}>
                    {milestone.description}
                  </Text>
                )}

                <Text style={styles.milestoneDetail}>
                  Deliverable Type: {milestone.deliverableType.replace(/_/g, ' ')}
                </Text>
                
                {milestone.dueDate && (
                  <Text style={styles.milestoneDetail}>
                    Due Date: {new Date(milestone.dueDate).toLocaleDateString()}
                  </Text>
                )}

                {milestone.retentionAmount && Number(milestone.retentionAmount) > 0 && (
                  <Text style={[styles.milestoneDetail, { color: '#dc2626', fontWeight: 'bold' }]}>
                    Retention (Warranty): ${Number(milestone.retentionAmount).toLocaleString()}
                  </Text>
                )}

                {milestone.acceptanceCriteria && milestone.acceptanceCriteria.length > 0 && (
                  <View style={{ marginTop: 5 }}>
                    <Text style={[styles.boldText, { fontSize: 9, marginBottom: 3 }]}>
                      Acceptance Criteria:
                    </Text>
                    {milestone.acceptanceCriteria.map((criteria, cIdx) => (
                      <Text key={cIdx} style={[styles.criteriaItem, { fontSize: 9 }]}>
                        ✓ {criteria}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            ))}
            
            {/* Total Summary */}
            <View style={{ marginTop: 10, padding: 10, backgroundColor: '#f1f5f9', borderRadius: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[styles.boldText, { fontSize: 12 }]}>TOTAL CONTRACT VALUE</Text>
                <Text style={[styles.boldText, { fontSize: 12, color: '#15803d' }]}>
                  ${milestones.reduce((sum, m) => sum + Number(m.amount), 0).toLocaleString()}
                </Text>
              </View>
              {milestones.some(m => m.retentionAmount && m.retentionAmount > 0) && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
                  <Text style={[styles.text, { fontSize: 10 }]}>Total Retention</Text>
                  <Text style={[styles.text, { fontSize: 10, color: '#dc2626' }]}>
                    ${milestones.reduce((sum, m) => sum + Number(m.retentionAmount || 0), 0).toLocaleString()}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Signature Section */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>CLIENT SIGNATURE</Text>
            <View style={styles.signatureLine}>
              <Text style={{ fontSize: 9, color: '#64748b' }}>
                {contract.project.client?.fullName}
              </Text>
            </View>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>BROKER SIGNATURE</Text>
            <View style={styles.signatureLine}>
              <Text style={{ fontSize: 9, color: '#64748b' }}>
                {contract.project.broker?.fullName}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            This is a legally binding agreement. Both parties agree to the terms and conditions outlined above.
          </Text>
          <Text style={{ marginTop: 4 }}>
            Generated on {new Date().toLocaleDateString()} | InterDev Platform
          </Text>
        </View>
      </Page>
    </Document>
  );
};
