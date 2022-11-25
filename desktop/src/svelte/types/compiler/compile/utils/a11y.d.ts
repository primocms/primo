import { ARIARoleDefintionKey } from 'aria-query';
import Attribute from '../nodes/Attribute';
export declare function is_non_interactive_roles(role: ARIARoleDefintionKey): boolean;
export declare function is_presentation_role(role: ARIARoleDefintionKey): boolean;
export declare function is_interactive_element(tag_name: string, attribute_map: Map<string, Attribute>): boolean;
