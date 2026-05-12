import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { colors } from '../../constants/colors';
import { getContext, updateContext } from '../../services/api';

// Section label above each card group
function SectionLabel({ title, icon }) {
  return (
    <View style={styles.sectionLabel}>
      <Ionicons name={icon} size={12} color={colors.textMuted} />
      <Text style={styles.sectionLabelText}>{title.toUpperCase()}</Text>
    </View>
  );
}

// White rounded card wrapper — auto-inserts hairline dividers between children
function FormCard({ children }) {
  const arr = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.formCard}>
      {arr.map((child, i) => (
        <View key={i}>
          {i > 0 && <View style={styles.cardDivider} />}
          {child}
        </View>
      ))}
    </View>
  );
}

// Single input row inside a card (label above, input below)
function CardField({ label, children }) {
  return (
    <View style={styles.cardField}>
      {!!label && <Text style={styles.cardFieldLabel}>{label}</Text>}
      {children}
    </View>
  );
}

function ListItemRow({ value, onRemove, index }) {
  return (
    <View style={styles.listItemRow}>
      <Text style={styles.listItemText} numberOfLines={2}>{value}</Text>
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => onRemove(index)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={14} color={colors.danger} />
      </TouchableOpacity>
    </View>
  );
}

function AddItemRow({ placeholder, onAdd }) {
  const [value, setValue] = useState('');
  const handleAdd = () => {
    if (value.trim()) { onAdd(value.trim()); setValue(''); }
  };
  return (
    <View style={styles.addRow}>
      <TextInput
        style={styles.addInput}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        onSubmitEditing={handleAdd}
        returnKeyType="done"
      />
      <TouchableOpacity
        onPress={handleAdd}
        disabled={!value.trim()}
        style={[styles.addBtn, !value.trim() && styles.addBtnDisabled]}
      >
        <Text style={[styles.addBtnText, !value.trim() && styles.addBtnTextDisabled]}>Add</Text>
      </TouchableOpacity>
    </View>
  );
}

function FamilyMemberRow({ member, onRemove, index }) {
  return (
    <View style={styles.listItemRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.listItemText}>{member.name}</Text>
        <Text style={styles.listItemSub}>{member.relation}</Text>
      </View>
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => onRemove(index)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={14} color={colors.danger} />
      </TouchableOpacity>
    </View>
  );
}

function AddFamilyRow({ onAdd }) {
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const handleAdd = () => {
    if (name.trim() && relation.trim()) {
      onAdd({ name: name.trim(), relation: relation.trim() });
      setName(''); setRelation('');
    }
  };
  return (
    <View style={styles.addFamilyRow}>
      <View style={styles.addFamilyInputs}>
        <TextInput
          style={[styles.addInput, { flex: 2 }]}
          value={name}
          onChangeText={setName}
          placeholder="Name"
          placeholderTextColor={colors.textLight}
          returnKeyType="next"
        />
        <TextInput
          style={[styles.addInput, { flex: 1 }]}
          value={relation}
          onChangeText={setRelation}
          placeholder="Relation"
          placeholderTextColor={colors.textLight}
          returnKeyType="done"
          onSubmitEditing={handleAdd}
        />
      </View>
      <TouchableOpacity
        onPress={handleAdd}
        disabled={!name.trim() || !relation.trim()}
        style={[styles.addBtn, (!name.trim() || !relation.trim()) && styles.addBtnDisabled]}
      >
        <Text style={[styles.addBtnText, (!name.trim() || !relation.trim()) && styles.addBtnTextDisabled]}>Add</Text>
      </TouchableOpacity>
    </View>
  );
}

const DEFAULT_CONTEXT = {
  name: '',
  age: '',
  dailyRoutine: '',
  medications: [],
  familyMembers: [],
  baselineRules: '',
  notes: '',
  favoriteSong: '',
  language: 'he',
};

export default function ContextScreen() {
  const { patientId } = useApp();
  const [context, setContext] = useState(DEFAULT_CONTEXT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const originalContextRef = useRef(null);

  useEffect(() => { loadContext(); }, [patientId]);

  const loadContext = async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await getContext(patientId);
      const normalized = {
        name: data.name || '',
        age: data.age ? String(data.age) : '',
        dailyRoutine: data.dailyRoutine || data.daily_routine || '',
        medications: Array.isArray(data.medications)
          ? data.medications.map((m) =>
              typeof m === 'string' ? m : [m.name, m.dosage, m.time].filter(Boolean).join(' ')
            )
          : [],
        familyMembers: Array.isArray(data.family) ? data.family : [],
        baselineRules: data.baselineRules || data.baseline_rules || '',
        notes: data.notes || '',
        favoriteSong: data.favoriteSong || '',
        language: data.language || 'he',
      };
      setContext(normalized);
      originalContextRef.current = JSON.stringify(normalized);
      setIsDirty(false);
    } catch (err) {
      setError('Could not load patient profile. Check your connection.');
      console.error('ContextScreen load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    setContext((prev) => {
      const updated = { ...prev, [field]: value };
      setIsDirty(JSON.stringify(updated) !== originalContextRef.current);
      return updated;
    });
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    if (!isDirty) return;
    try {
      setSaving(true);
      setError(null);
      await updateContext(patientId, {
        ...context,
        family: context.familyMembers,
        age: context.age ? parseInt(context.age, 10) : undefined,
        favoriteSong: context.favoriteSong || null,
      });
      originalContextRef.current = JSON.stringify(context);
      setIsDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError('Could not save changes. Please try again.');
      Alert.alert('Save Failed', 'Could not save changes. Please try again.');
      console.error('ContextScreen save error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading patient profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {isDirty && (
          <View style={styles.dirtyBanner}>
            <Ionicons name="ellipse" size={8} color="#B45309" />
            <Text style={styles.dirtyBannerText}>Unsaved changes</Text>
          </View>
        )}
        {saveSuccess && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={14} color="#166534" />
            <Text style={styles.successBannerText}>Saved successfully</Text>
          </View>
        )}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Basic Information ── */}
          <SectionLabel title="Basic Information" icon="person-outline" />
          <FormCard>
            <CardField label="Full Name">
              <TextInput
                style={styles.cardInput}
                value={context.name}
                onChangeText={(v) => updateField('name', v)}
                placeholder="Patient's full name"
                placeholderTextColor={colors.textLight}
                returnKeyType="next"
              />
            </CardField>
            <CardField label="Age">
              <TextInput
                style={styles.cardInput}
                value={context.age}
                onChangeText={(v) => updateField('age', v)}
                placeholder="e.g. 78"
                placeholderTextColor={colors.textLight}
                keyboardType="numeric"
                returnKeyType="next"
              />
            </CardField>
          </FormCard>

          {/* ── Daily Routine ── */}
          <SectionLabel title="Daily Routine" icon="time-outline" />
          <FormCard>
            <CardField>
              <TextInput
                style={[styles.cardInput, styles.cardTextArea]}
                value={context.dailyRoutine}
                onChangeText={(v) => updateField('dailyRoutine', v)}
                placeholder="Describe the patient's typical daily routine..."
                placeholderTextColor={colors.textLight}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </CardField>
          </FormCard>

          {/* ── Medications ── */}
          <SectionLabel title="Medications" icon="medical-outline" />
          <FormCard>
            {context.medications.length === 0 && (
              <View style={styles.emptyCardRow}>
                <Text style={styles.emptyCardText}>No medications added</Text>
              </View>
            )}
            {context.medications.map((med, index) => (
              <ListItemRow
                key={index}
                value={med}
                index={index}
                onRemove={(i) => updateField('medications', context.medications.filter((_, k) => k !== i))}
              />
            ))}
            <CardField>
              <AddItemRow
                placeholder="Add medication (e.g. Aricept 10mg daily)"
                onAdd={(v) => updateField('medications', [...context.medications, v])}
              />
            </CardField>
          </FormCard>

          {/* ── Family Members ── */}
          <SectionLabel title="Family Members" icon="people-outline" />
          <FormCard>
            {context.familyMembers.length === 0 && (
              <View style={styles.emptyCardRow}>
                <Text style={styles.emptyCardText}>No family members added</Text>
              </View>
            )}
            {context.familyMembers.map((member, index) => (
              <FamilyMemberRow
                key={index}
                member={member}
                index={index}
                onRemove={(i) => updateField('familyMembers', context.familyMembers.filter((_, k) => k !== i))}
              />
            ))}
            <CardField>
              <AddFamilyRow
                onAdd={(v) => updateField('familyMembers', [...context.familyMembers, v])}
              />
            </CardField>
          </FormCard>

          {/* ── Baseline Rules ── */}
          <SectionLabel title="Baseline Rules" icon="shield-checkmark-outline" />
          <FormCard>
            <CardField>
              <TextInput
                style={[styles.cardInput, styles.cardTextArea]}
                value={context.baselineRules}
                onChangeText={(v) => updateField('baselineRules', v)}
                placeholder="Rules for the AI assistant (e.g. always remind to drink water)..."
                placeholderTextColor={colors.textLight}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </CardField>
          </FormCard>

          {/* ── Language ── */}
          <SectionLabel title="Speaking Language" icon="globe-outline" />
          <FormCard>
            <TouchableOpacity
              style={styles.langRow}
              onPress={() => updateField('language', 'he')}
              activeOpacity={0.7}
            >
              <Text style={styles.langRowText}>עברית — Hebrew</Text>
              {context.language === 'he' && (
                <Ionicons name="checkmark" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.langRow}
              onPress={() => updateField('language', 'en')}
              activeOpacity={0.7}
            >
              <Text style={styles.langRowText}>English</Text>
              {context.language === 'en' && (
                <Ionicons name="checkmark" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
          </FormCard>
          <Text style={styles.hint}>
            The AI assistant will speak and respond in this language.
          </Text>

          {/* ── Favorite Song ── */}
          <SectionLabel title="Favorite Song" icon="musical-notes-outline" />
          <FormCard>
            <CardField label="Song name">
              <TextInput
                style={styles.cardInput}
                value={context.favoriteSong}
                onChangeText={(v) => updateField('favoriteSong', v)}
                placeholder="e.g. Yesterday by The Beatles"
                placeholderTextColor={colors.textLight}
                returnKeyType="next"
              />
            </CardField>
          </FormCard>
          <Text style={styles.hint}>
            Played automatically when the patient triggers an SOS alert.
          </Text>

          {/* ── Additional Notes ── */}
          <SectionLabel title="Additional Notes" icon="document-text-outline" />
          <FormCard>
            <CardField>
              <TextInput
                style={[styles.cardInput, styles.cardTextArea]}
                value={context.notes}
                onChangeText={(v) => updateField('notes', v)}
                placeholder="Any additional notes for the AI assistant..."
                placeholderTextColor={colors.textLight}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </CardField>
          </FormCard>

          {/* ── Save Button ── */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={!isDirty || saving}
            activeOpacity={0.85}
            style={[styles.saveWrapper, (!isDirty || saving) && styles.saveWrapperDisabled]}
          >
            {isDirty && !saving ? (
              <LinearGradient
                colors={colors.gradientPrimary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveBtn}
              >
                <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </LinearGradient>
            ) : (
              <View style={[styles.saveBtn, styles.saveBtnInactive]}>
                {saving
                  ? <ActivityIndicator color={colors.primary} size="small" />
                  : <Text style={styles.saveBtnTextInactive}>All Changes Saved</Text>
                }
              </View>
            )}
          </TouchableOpacity>

          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText: { marginTop: 12, fontSize: 17, color: colors.textMuted },

  // Status banners
  dirtyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  dirtyBannerText: { fontSize: 13, color: '#92400E', fontWeight: '600' },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#BBF7D0',
  },
  successBannerText: { fontSize: 13, color: '#166534', fontWeight: '600' },
  errorBanner: {
    backgroundColor: colors.dangerLight,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  errorBannerText: { fontSize: 13, color: '#991B1B', fontWeight: '500' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 12 },

  // Section labels
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.9,
  },

  // Form card
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginLeft: 16,
  },
  cardField: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  cardFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  cardInput: {
    fontSize: 16,
    color: colors.text,
    padding: 0,
    backgroundColor: 'transparent',
  },
  cardTextArea: {
    minHeight: 100,
    paddingTop: 2,
    lineHeight: 24,
  },

  // Empty state inside card
  emptyCardRow: {
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  emptyCardText: {
    fontSize: 14,
    color: colors.textLight,
    fontStyle: 'italic',
  },

  // List item inside card
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
  },
  listItemText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    fontWeight: '500',
  },
  listItemSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  removeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Add item row (inside card)
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addFamilyRow: {
    gap: 8,
  },
  addFamilyInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  addInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    padding: 0,
    backgroundColor: 'transparent',
  },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
  },
  addBtnDisabled: { backgroundColor: 'transparent' },
  addBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  addBtnTextDisabled: { color: colors.textLight },

  // Language selector rows (iOS-style list)
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  langRowText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },

  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
    marginLeft: 4,
    lineHeight: 18,
  },

  // Save button
  saveWrapper: {
    marginTop: 32,
    borderRadius: 28,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  saveWrapperDisabled: { shadowOpacity: 0, elevation: 0 },
  saveBtn: {
    borderRadius: 28,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  saveBtnInactive: {
    backgroundColor: colors.borderLight,
  },
  saveBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.3,
  },
  saveBtnTextInactive: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
