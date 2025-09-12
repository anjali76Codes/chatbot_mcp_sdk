// // src/components/RichTextRenderer.tsx
// interface TextNode {
//   type: 'text';
//   text: string;
//   bold?: boolean;
//   italic?: boolean;
//   underline?: boolean;
// }

// interface ParagraphNode {
//   type: 'paragraph';
//   children: RichTextNode[];
// }

// interface HeadingNode {
//   type: 'heading';
//   level: number;
//   children: RichTextNode[];
// }

// interface ListNode {
//   type: 'list';
//   format: 'ordered' | 'unordered';
//   children: RichTextNode[];
// }

// interface ListItemNode {
//   type: 'list-item';
//   children: RichTextNode[];
// }

// interface LinkNode {
//   type: 'link';
//   url: string;
//   newTab?: boolean;
//   children: RichTextNode[];
// }

// interface UnknownNode {
//   type: string;
//   children?: RichTextNode[];
//   [key: string]: any;
// }

// type RichTextNode = TextNode | ParagraphNode | HeadingNode | ListNode | ListItemNode | LinkNode | UnknownNode;

// interface RichTextRendererProps {
//   content: any;
//   className?: string;
// }

// export const RichTextRenderer = ({ content, className = '' }: RichTextRendererProps) => {
//   if (!content) return null;

//   // If content is already a string (not JSON), just display it
//   if (typeof content === 'string') {
//     // Check if it's a JSON string that needs parsing
//     try {
//       const parsed = JSON.parse(content);
//       return <RichTextRenderer content={parsed} className={className} />;
//     } catch {
//       // It's a plain text string
//       return <div className={className}>{content}</div>;
//     }
//   }

//   // If content is an object but not array, try to handle it
//   if (typeof content === 'object' && !Array.isArray(content)) {
//     // Check if it's a Rich Text JSON structure
//     if (content.json) {
//       return <RichTextRenderer content={content.json} className={className} />;
//     }
//     // Fallback: stringify the object for debugging
//     return <div className={className}>{JSON.stringify(content, null, 2)}</div>;
//   }

//   const renderNode = (node: RichTextNode, index: number): React.ReactNode => {
//     if (typeof node === 'string') {
//       return node;
//     }

//     if (!node || typeof node !== 'object') {
//       return null;
//     }

//     // Handle text nodes with formatting
//     if (node.type === 'text') {
//       let textElement = node.text || '';
      
//       if (node.bold) {
//         textElement = <strong key={index}>{textElement}</strong>;
//       }
//       if (node.italic) {
//         textElement = <em key={index}>{textElement}</em>;
//       }
//       if (node.underline) {
//         textElement = <u key={index}>{textElement}</u>;
//       }
      
//       return textElement;
//     }

//     // Handle different node types
//     switch (node.type) {
//       case 'paragraph':
//         return (
//           <p key={index} className="mb-4">
//             {node.children?.map((child, i) => renderNode(child, i))}
//           </p>
//         );
      
//       case 'heading':
//         const HeadingTag = `h${node.level}` as keyof JSX.IntrinsicElements;
//         return (
//           <HeadingTag key={index} className={`mb-3 font-bold ${
//             node.level === 1 ? 'text-2xl' : 
//             node.level === 2 ? 'text-xl' : 
//             node.level === 3 ? 'text-lg' : 'text-base'
//           }`}>
//             {node.children?.map((child, i) => renderNode(child, i))}
//           </HeadingTag>
//         );
      
//       case 'list':
//         const ListTag = node.format === 'ordered' ? 'ol' : 'ul';
//         return (
//           <ListTag key={index} className={`mb-4 ${
//             node.format === 'ordered' ? 'list-decimal pl-6' : 'list-disc pl-6'
//           }`}>
//             {node.children?.map((child, i) => renderNode(child, i))}
//           </ListTag>
//         );
      
//       case 'list-item':
//         return (
//           <li key={index} className="mb-2">
//             {node.children?.map((child, i) => renderNode(child, i))}
//           </li>
//         );
      
//       case 'link':
//         return (
//           <a
//             key={index}
//             href={node.url}
//             target={node.newTab ? '_blank' : '_self'}
//             rel="noopener noreferrer"
//             className="text-blue-600 hover:text-blue-800 underline"
//           >
//             {node.children?.map((child, i) => renderNode(child, i))}
//           </a>
//         );
      
//       default:
//         // Fallback for unknown node types
//         return (
//           <span key={index}>
//             {(node as UnknownNode).children?.map((child, i) => renderNode(child, i))}
//           </span>
//         );
//     }
//   };

//   try {
//     const nodes = Array.isArray(content) ? content : [content];
    
//     return (
//       <div className={`rich-text-content ${className}`}>
//         {nodes.map((node, index) => renderNode(node, index))}
//       </div>
//     );
//   } catch (error) {
//     console.error('Error rendering rich text:', error, content);
//     return (
//       <div className={`text-red-500 ${className}`}>
//         Error displaying content. Raw data: {JSON.stringify(content)}
//       </div>
//     );
//   }
// };