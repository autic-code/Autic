/**
 * SkillRegistry — Central registry for skill definitions.
 *
 * Manages:
 *   - Skill registration and unregistration
 *   - Skill lookup by id, name, and capability
 *   - Version support foundation
 *   - Skill metadata and dependency tracking
 */

import type { SkillDefinition, SkillSource } from '@autic/shared';

export interface SkillRegistryOptions {
  maxSkills?: number;
}

export class SkillRegistry {
  private skills: Map<string, SkillDefinition> = new Map();
  private maxSkills: number;

  constructor(options: SkillRegistryOptions = {}) {
    this.maxSkills = options.maxSkills || 100;
  }

  /**
   * Register a skill definition.
   */
  register(skill: SkillDefinition): void {
    if (this.skills.size >= this.maxSkills) {
      throw new Error(`Skill registry full (max ${this.maxSkills})`);
    }
    if (this.skills.has(skill.id)) {
      throw new Error(`Skill already registered: ${skill.id}`);
    }
    this.skills.set(skill.id, { ...skill });
  }

  /**
   * Unregister a skill by id.
   */
  unregister(id: string): boolean {
    return this.skills.delete(id);
  }

  /**
   * Get a skill by id.
   */
  get(id: string): SkillDefinition | undefined {
    return this.skills.get(id);
  }

  /**
   * Find skills by name (case-insensitive partial match).
   */
  findByName(name: string): SkillDefinition[] {
    const lower = name.toLowerCase();
    return this.list().filter(
      (s) => s.name.toLowerCase().includes(lower) || s.id.toLowerCase().includes(lower),
    );
  }

  /**
   * Find skills by capability.
   */
  findByCapability(capability: string): SkillDefinition[] {
    return this.list().filter((s) =>
      s.capabilities.some((c) => c.toLowerCase().includes(capability.toLowerCase())),
    );
  }

  /**
   * List all registered skills.
   */
  list(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /**
   * Check if a skill is registered.
   */
  has(id: string): boolean {
    return this.skills.has(id);
  }

  /**
   * Get the total count of registered skills.
   */
  count(): number {
    return this.skills.size;
  }

  /**
   * Load a skill from a source (local file or inline definition).
   * For Phase 7, supports inline definitions; file loading is a hook.
   */
  async loadFromSource(source: SkillSource): Promise<SkillDefinition> {
    if (source.type === 'inline' && source.content) {
      const skill = JSON.parse(source.content) as SkillDefinition;
      this.validateSkillDefinition(skill);
      this.register(skill);
      return skill;
    }

    if (source.type === 'local' && source.path) {
      // Placeholder for local file loading (future: read from disk, parse JSON/YAML)
      throw new Error('Local file skill loading not yet implemented');
    }

    throw new Error('Invalid skill source: must provide content for inline or path for local');
  }

  /**
   * Clear all skills.
   */
  clear(): void {
    this.skills.clear();
  }

  /**
   * Basic validation that a skill definition has required fields.
   */
  private validateSkillDefinition(skill: SkillDefinition): void {
    if (!skill.id) throw new Error('Skill missing required field: id');
    if (!skill.name) throw new Error('Skill missing required field: name');
    if (!skill.version) throw new Error('Skill missing required field: version');
    if (!skill.description) throw new Error('Skill missing required field: description');
    if (!skill.type) throw new Error('Skill missing required field: type');
    if (!Array.isArray(skill.capabilities)) throw new Error('Skill capabilities must be an array');
    if (!Array.isArray(skill.toolPermissions))
      throw new Error('Skill toolPermissions must be an array');
  }
}
